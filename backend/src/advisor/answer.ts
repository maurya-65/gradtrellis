// Answers questions in plain words. Every fact comes from the audit, the prerequisite checks or
// the catalog; the only model-written text is the short reason beside a topic search result.
import { courseIndex, gradingScale, snapshot } from "../catalog.ts";
import {
  earnsCredit,
  isInProgress,
  nextTerm,
  termLabel,
  termOn,
  type CourseCode,
  type RequirementResult,
  type StudentRecord,
  type Term,
} from "../engine/index.ts";
import { auditOf, eligibility, programSubjects, suggestions } from "../planning.ts";
import { QUESTION_WORDS, speller } from "./language.ts";
import { rerank, type Pick } from "./rerank.ts";
import { coursesLike, type Match } from "./search.ts";
import { understand, type Understanding } from "./understand.ts";

const WHAT_I_CAN_DO =
  "I can tell you what's left in your degree, whether you can take a course, what to take next term, what a course is about, " +
  'courses on a topic you like, what Honours or the Cybersecurity specialization takes, and your CGPA. Try "Can I take CS 3383 next term?"';

// shown after anything longer is cut
const LISTED = 6;
const MATCHES = 5;
// what local search hands the model to choose from
const CANDIDATES = 20;
// how close in meaning (about 0-1) the best match must be: an unrecognised question this close to
// some courses is a topic; anything below WEAK_MATCH isn't really about any course
const CLOSE_MATCH = 0.5;
const WEAK_MATCH = 0.3;

const noPeriod = (s: string) => s.trim().replace(/\.$/, "");

function notListed(code: CourseCode): string {
  return `I couldn't find ${code} in the ${snapshot.calendarYear} calendar.`;
}

function progress(record: StudentRecord): string {
  const audit = auditOf(record);
  const { courses, creditHours } = audit.totals;
  const underway = [courses.inProgress && `${courses.inProgress} in progress`, courses.planned && `${courses.planned} planned`].filter(Boolean);
  const lines = [
    `You've finished ${courses.have} of ${courses.need} courses (${creditHours.have} of ${creditHours.need} credit hours)` +
      (underway.length ? `, with ${underway.join(" and ")}.` : "."),
  ];
  const open = [...audit.requirements, ...audit.designations.flatMap((d) => d.requirements)].filter((r) => r.status !== "complete");
  if (open.length === 0) {
    lines.push("Every requirement is met or on its way.");
  } else {
    lines.push("Still to go:", ...open.map((r) => `- ${r.title}: ${noPeriod(r.remaining)}`));
  }
  return lines.join("\n");
}

function gpa(record: StudentRecord): string {
  const { cgpa } = auditOf(record);
  return cgpa === "—" ? "You don't have any graded courses yet, so there's no CGPA." : `Your CGPA is ${cgpa}.`;
}

function canTake(code: CourseCode, record: StudentRecord, term: Term): string {
  if (!courseIndex.has(code)) return notListed(code);
  if (record.attempts.some((a) => a.code === code && earnsCredit(a, gradingScale))) return `You've already passed ${code}.`;

  const e = eligibility(code, record, term);
  const when = termLabel(term);
  const needs = [e.prereqText && noPeriod(e.prereqText), e.coreqText && `alongside it, ${noPeriod(e.coreqText)}`].filter(Boolean).join("; ");
  switch (e.status) {
    case "met":
      return `Yes, you can take ${code} (${e.title}) in ${when}.`;
    case "pending":
      return `Yes, once you pass the courses you're taking now. ${code} needs: ${needs}.`;
    case "missing":
      return `Not yet for ${when}. ${code} needs: ${needs}.`;
    case "review":
      return `Maybe. Part of ${code}'s requirements needs a person to check: "${needs}". Ask the instructor or your Faculty advisor.`;
  }
}

function nextCourses(record: StudentRecord, term: Term): string {
  const open = suggestions(record, term);
  const when = termLabel(term);
  if (open.length === 0) {
    return `No required courses are open to you for ${when}. Electives are up to you; your audit shows how many you still need.`;
  }
  const note = { met: "", pending: " (once your current courses are done)", review: " (check the prerequisites)", missing: "" };
  const lines = [`For ${when}, these required courses are open to you:`, ...open.slice(0, LISTED).map((c) => `- ${c.code} ${c.title}${note[c.status]}`)];
  if (open.length > LISTED) lines.push(`And ${open.length - LISTED} more in your audit.`);
  return lines.join("\n");
}

// where the student stands on a course
function standing(code: CourseCode, record: StudentRecord, term: Term): string {
  const tries = record.attempts.filter((a) => a.code === code);
  if (tries.some((a) => earnsCredit(a, gradingScale))) return "you've passed it";
  if (tries.some(isInProgress)) return "you're taking it or have it planned";
  switch (eligibility(code, record, term).status) {
    case "met":
      return `open to you in ${termLabel(term)}`;
    case "pending":
      return "open once your current courses are done";
    case "review":
      return "check the prerequisites";
    case "missing":
      return "you don't have the prerequisites yet";
  }
}

// Local search's candidates, narrowed and reordered by the model chain when one answers; otherwise
// the local order, without reasons.
async function onTopic(question: Understanding, candidates: Match[], record: StudentRecord, term: Term): Promise<string> {
  const picks: Pick[] = (await rerank(question.text, candidates, MATCHES)) ?? candidates.slice(0, MATCHES).map((match) => ({ match, why: "" }));
  const lines = [
    "These courses are closest to what you asked about:",
    ...picks.map(({ match: { course }, why }) => `- ${course.code} ${course.title} (${standing(course.code, record, term)})${why ? `: ${why}` : ""}`),
    "Your audit shows where each would count toward your degree.",
  ];
  if (question.designation === "cybersecurity") {
    lines.push('There\'s also a Specialization in Cybersecurity. Ask "What do I need for the cybersecurity specialization?" to see what it takes.');
  }
  return lines.join("\n");
}

const usedIn = (r: RequirementResult): string[] => [...r.used.map((u) => u.code), ...(r.children ?? []).flatMap(usedIn)];

// What a designation takes, from the audit run as if the student were pursuing it.
function designationNeeds(id: string, record: StudentRecord): string {
  const pursuing = record.designations.includes(id);
  const audit = auditOf(pursuing ? record : { ...record, designations: [...record.designations, id] });
  const found = audit.designations.find((d) => d.id === id);
  if (!found) return "Your program's calendar doesn't have that designation.";

  const lines =
    found.status === "complete"
      ? [`You've met everything for the ${found.name}.`]
      : [`The ${found.name} needs:`, ...found.requirements.map((r) => `- ${r.title}: ${r.status === "complete" ? "done" : noPeriod(r.remaining)}`)];
  const counting = [...new Set(found.requirements.flatMap(usedIn))];
  if (counting.length) lines.push(`Counting so far: ${counting.join(", ")}.`);
  if (found.tier) lines.push(`At your CGPA now, that's ${found.tier}.`);
  if (!pursuing) lines.push("You haven't added it to your degree yet; you can in your profile.");
  return lines.join("\n");
}

function aboutCourse(code: CourseCode): string {
  const course = courseIndex.get(code);
  if (!course) return notListed(code);
  const summary = course.description.split(/(?<=\.)\s/)[0];
  const lines = [`${code} ${course.title} (${course.creditHours} ch). ${summary}`, `Prerequisites: ${course.prereqText ? noPeriod(course.prereqText) : "none"}.`];
  if (course.coreqText) lines.push(`Corequisites: ${noPeriod(course.coreqText)}.`);
  return lines.join("\n");
}

export async function answer(question: Understanding, record: StudentRecord, now = new Date()): Promise<string> {
  const term = question.term ?? nextTerm(termOn(now));
  switch (question.intent) {
    case "designation":
      return designationNeeds(question.designation!, record);
    case "explore": {
      const candidates = await coursesLike(question.text, { limit: CANDIDATES, field: programSubjects(record) });
      if (candidates[0]!.similarity < WEAK_MATCH) return "I couldn't find courses about that in the calendar. Try describing the topic another way.";
      return onTopic(question, candidates, record, term);
    }
    case "progress":
      return progress(record);
    case "gpa":
      return gpa(record);
    case "eligibility":
      return question.courses.map((code) => canTake(code, record, term)).join("\n\n");
    case "next-term":
      return nextCourses(record, term);
    case "course-info":
      return question.courses.map(aboutCourse).join("\n\n");
    case "greeting":
      return `Hi! ${WHAT_I_CAN_DO}`;
    case "unknown": {
      // maybe just a topic ("databases?"); off-topic questions don't come close to any course
      const candidates = await coursesLike(question.text, { limit: CANDIDATES, field: programSubjects(record) });
      if (candidates[0]!.similarity >= CLOSE_MATCH) return onTopic(question, candidates, record, term);
      return `I can't answer that one yet. ${WHAT_I_CAN_DO}`;
    }
  }
}

const reader = {
  subjects: new Set(snapshot.subjects),
  // the calendar's own words, so course terms are spelled the way the calendar spells them
  fixSpelling: speller(
    snapshot.courses.flatMap((c) => [c.title, c.description]),
    QUESTION_WORDS,
  ),
};

export async function ask(question: string, record: StudentRecord, now = new Date()) {
  const understood = understand(question, { ...reader, now });
  return { intent: understood.intent, answer: await answer(understood, record, now) };
}

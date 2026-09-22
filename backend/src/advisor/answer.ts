// Answers the questions the engine can answer exactly, in plain words. Nothing here is
// generated: every fact comes from the audit, the prerequisite checks or the catalog.
import { courseIndex, gradingScale, snapshot } from "../catalog.ts";
import { earnsCredit, nextTerm, termLabel, termOn, type CourseCode, type StudentRecord, type Term } from "../engine/index.ts";
import { auditOf, eligibility, suggestions } from "../planning.ts";
import { understand, type Understanding } from "./understand.ts";

const WHAT_I_CAN_DO =
  "I can tell you what's left in your degree, whether you can take a course, what to take next term, what a course is about, and your CGPA. " +
  'Try "Can I take CS 3383 next term?"';

// shown after anything longer is cut
const LISTED = 6;

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

function aboutCourse(code: CourseCode): string {
  const course = courseIndex.get(code);
  if (!course) return notListed(code);
  const summary = course.description.split(/(?<=\.)\s/)[0];
  const lines = [`${code} ${course.title} (${course.creditHours} ch). ${summary}`, `Prerequisites: ${course.prereqText ? noPeriod(course.prereqText) : "none"}.`];
  if (course.coreqText) lines.push(`Corequisites: ${noPeriod(course.coreqText)}.`);
  return lines.join("\n");
}

export function answer(question: Understanding, record: StudentRecord, now = new Date()): string {
  const term = question.term ?? nextTerm(termOn(now));
  switch (question.intent) {
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
    case "unknown":
      return `I can't answer that one yet. ${WHAT_I_CAN_DO}`;
  }
}

const subjects = new Set(snapshot.subjects);

export function ask(question: string, record: StudentRecord, now = new Date()) {
  const understood = understand(question, subjects, now);
  return { intent: understood.intent, answer: answer(understood, record, now) };
}

// Reads a student's question locally: which courses and term it's about, and what kind of
// question it is. Spelling is fixed and shorthand spelled out first; then pattern rules decide,
// and anything they don't recognise is "unknown".
import { compareTerms, nextTerm, termOn, type CourseCode, type Term } from "../engine/index.ts";
import { expandShorthand } from "./language.ts";

export type Intent = "designation" | "gpa" | "eligibility" | "course-info" | "explore" | "next-term" | "progress" | "greeting" | "unknown";

// designations (by their id in the program data) and how students write them, after shorthand
// is spelled out ("cyber sec" is already "cybersecurity sec")
const DESIGNATIONS: Array<[string, RegExp]> = [
  ["cybersecurity", /\bcybersecurity\b/],
  ["honours", /\bhonou?rs\b/],
];

export interface Understanding {
  intent: Intent;
  // course codes mentioned, in order, without repeats
  courses: CourseCode[];
  // the term asked about, if any
  term: Term | null;
  // the question tidied up (lower case, spelling fixed, shorthand spelled out), for searching
  text: string;
  // a designation mentioned (its program data id), even if the question is about something else
  designation: string | null;
}

export interface Reader {
  // real subject codes, so "fall 2026" isn't read as a course
  subjects: ReadonlySet<string>;
  fixSpelling?: (text: string) => string;
  now?: Date;
}

// "cs3383", "CS 3383", "cs-3383"; only real subjects, so "fall 2026" or "year 2025" aren't courses
function coursesIn(question: string, subjects: ReadonlySet<string>): CourseCode[] {
  const codes = [...question.matchAll(/\b([a-z]{2,5})[\s-]?(\d{4})\b/gi)]
    .map((m) => `${m[1]!.toUpperCase()} ${m[2]}`)
    .filter((code) => subjects.has(code.split(" ")[0]!));
  return [...new Set(codes)];
}

const SEASON: Record<string, Term["season"]> = { winter: "Winter", summer: "Summer", fall: "Fall", autumn: "Fall" };

function termIn(text: string, now: Date): Term | null {
  const current = termOn(now);
  if (/\bnext (?:term|semester)\b/.test(text)) return nextTerm(current);
  if (/\bthis (?:term|semester)\b/.test(text)) return current;

  const m = /\b(next )?(winter|summer|fall|autumn)(?: (\d{4}))?\b/.exec(text);
  if (!m) return null;
  const season = SEASON[m[2]!]!;
  if (m[3]) return { season, year: Number(m[3]) };
  // the coming one: "fall" in the fall is this fall, "next fall" is a year on
  const term = { season, year: current.year };
  const passed = compareTerms(term, current);
  return passed < 0 || (m[1] && passed === 0) ? { season, year: current.year + 1 } : term;
}

// First match wins, so the more specific kinds come first.
interface Found {
  course: boolean;
  designation: string | null;
}

const RULES: Array<[Intent, (text: string, found: Found) => boolean]> = [
  // Honours by name is always about the designation; cybersecurity only with "specialization",
  // since "I like cybersecurity" is a topic
  ["designation", (t, f) => !f.course && (f.designation === "honours" || (f.designation !== null && /\bspeciali[sz]/.test(t)))],
  ["gpa", (t) => /\b(?:c?gpa|grade point)/.test(t)],
  [
    "eligibility",
    (t, f) => f.course && /\b(?:can i|could i|am i (?:allowed|eligible|able|ready)|eligible|allowed to|ready (?:for|to take)|qualify|pre-?req|requisite|requirements? for|do i meet)/.test(t),
  ],
  ["course-info", (_t, f) => f.course],
  [
    "explore",
    (t) =>
      /\b(?:interested in|i'?m (?:really |so |very )?into|i (?:really )?(?:like|love|enjoy)|passionate about|courses? (?:on|about|related to)|anything (?:on|about)|learn (?:about|more)|something (?:on|about|with))\b/.test(
        t,
      ),
  ],
  [
    "next-term",
    (t) =>
      /\bwhat (?:should|can|do) i take\b|\bsuggest|\brecommend|\bwhat(?:'s| is) next\b/.test(t) ||
      /\b(?:next|coming|upcoming|winter|summer|fall|autumn)\b.*\b(?:take|courses?|classes|register|enrol)/.test(t),
  ],
  ["progress", (t) => /\b(?:left|remain|still need|to go|on track|progress|how (?:far|close|many)|graduat|finish|requirements?|audit)/.test(t)],
  ["greeting", (t) => /^(?:hi|hey|hello|yo|sup|good (?:morning|afternoon|evening))\b|what can you do|how do(?:es)? (?:this|you) work|^help\b/.test(t)],
];

export function understand(question: string, { subjects, fixSpelling = (t) => t, now = new Date() }: Reader): Understanding {
  const plain = question.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
  const courses = coursesIn(plain, subjects);
  const text = expandShorthand(fixSpelling(plain));
  const designation = DESIGNATIONS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
  const intent = RULES.find(([, matches]) => matches(text, { course: courses.length > 0, designation }))?.[0] ?? "unknown";
  return { intent, courses, term: termIn(text, now), text, designation };
}

// Reads a student's question locally: which courses and term it's about, and what kind of
// question it is. Pattern rules only; anything they don't recognise is "unknown".
import { compareTerms, nextTerm, termOn, type CourseCode, type Term } from "../engine/index.ts";

export type Intent = "gpa" | "eligibility" | "course-info" | "next-term" | "progress" | "greeting" | "unknown";

export interface Understanding {
  intent: Intent;
  // course codes mentioned, in order, without repeats
  courses: CourseCode[];
  // the term asked about, if any
  term: Term | null;
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
const RULES: Array<[Intent, (text: string, hasCourse: boolean) => boolean]> = [
  ["gpa", (t) => /\b(?:c?gpa|grade point)/.test(t)],
  [
    "eligibility",
    (t, c) => c && /\b(?:can i|could i|am i (?:allowed|eligible|able|ready)|eligible|allowed to|ready (?:for|to take)|qualify|pre-?req|requisite|requirements? for|do i meet)/.test(t),
  ],
  ["course-info", (_t, c) => c],
  [
    "next-term",
    (t) =>
      /\bwhat (?:should|can|do) i take\b|\bsuggest|\brecommend|\bwhat(?:'s| is) next\b/.test(t) ||
      /\b(?:next|coming|upcoming|winter|summer|fall|autumn)\b.*\b(?:take|courses?|classes|register|enrol)/.test(t),
  ],
  ["progress", (t) => /\b(?:left|remain|still need|to go|on track|progress|how (?:far|close|many)|graduat|finish|requirements?|audit)/.test(t)],
  ["greeting", (t) => /^(?:hi|hey|hello|yo|sup|good (?:morning|afternoon|evening))\b|what can you do|how do(?:es)? (?:this|you) work|^help\b/.test(t)],
];

export function understand(question: string, subjects: ReadonlySet<string>, now = new Date()): Understanding {
  const text = question.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
  const courses = coursesIn(text, subjects);
  const intent = RULES.find(([, matches]) => matches(text, courses.length > 0))?.[0] ?? "unknown";
  return { intent, courses, term: termIn(text, now) };
}

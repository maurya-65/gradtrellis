// Prerequisites and corequisites: the calendar's text ("CS 1083, CS 1543 and (CS 1303 or
// MATH 2203).") parsed into a tree, and checked against a student's record for a given term.
// Anything the parser doesn't understand (instructor permission, high school courses, wording
// it can't read with certainty) stays as text and comes out as "review", so a person decides.
import { earnsCredit, isInProgress, meetsGrade } from "./grades.ts";
import { courseFacts, type CourseIndex } from "./courses.ts";
import type { Attempt } from "./record.ts";
import type { CourseCode, Term } from "./schema/common.ts";
import type { GradingScale, LetterGrade } from "./schema/grades.ts";
import { compareTerms } from "./terms.ts";

export type Requisite =
  | { type: "course"; code: CourseCode; minGrade?: LetterGrade }
  // subjects limits which courses count ("12 ch in Mathematics and/or Statistics")
  | { type: "creditHours"; min: number; subjects?: string[] }
  | { type: "program"; code: string }
  | { type: "all"; of: Requisite[] }
  | { type: "any"; of: Requisite[] }
  | { type: "text"; text: string };

// met: done before the term; pending: only by courses still in progress or planned before it
export type RequisiteStatus = "met" | "pending" | "missing" | "review";

// a grade minimum waiting for the course it belongs to ("a grade of B or higher in ...")
type GradeFor = { gradeFor: LetterGrade };
type Token = Requisite | GradeFor | "and" | "or" | "," | "(" | ")";

// subject names as the calendar writes them in "N ch in ..."
const SUBJECTS: Record<string, string> = {
  mathematics: "MATH",
  statistics: "STAT",
  "computer science": "CS",
  physics: "PHYS",
  chemistry: "CHEM",
  biology: "BIOL",
  economics: "ECON",
  psychology: "PSYC",
  english: "ENGL",
};
const SUBJECT = Object.keys(SUBJECTS).join("|");
const GRADE = "([A-D][+-]?)";

const course = (code: string): Requisite => ({ type: "course", code });

// "MATH 3463/PHYS 3912" and "MAAC/CCS 2021" are one course listed under two codes
function crossListed(raw: string): Requisite {
  const codes = raw.replace(/\s+/g, " ").split("/");
  const number = /\d{4}/.exec(codes.at(-1)!)![0];
  const all = codes.map((c) => (/\d/.test(c) ? c.replace(/^([A-Z]+) ?/, "$1 ") : `${c} ${number}`));
  return all.length === 1 ? course(all[0]!) : { type: "any", of: all.map(course) };
}

// Tried in order at each position; the first match wins.
const RULES: Array<[RegExp, (m: RegExpExecArray) => Token]> = [
  [new RegExp(`(?:an? )?(?:minimum )?grade of ${GRADE}(?: or (?:better|higher))? in\\b`, "iy"), (m) => ({ gradeFor: m[1]!.toUpperCase() as LetterGrade })],
  [/[A-Z]{2,5}(?:\/[A-Z]{2,5})* ?\d{4}(?:\/[A-Z]{2,5} ?\d{4})*/y, (m) => crossListed(m[0])],
  [
    new RegExp(`(?:at least )?(\\d+) ?ch (?:in|of) (?:university )?(${SUBJECT})(?: and/or (${SUBJECT}))?\\b`, "iy"),
    (m) => ({ type: "creditHours", min: Number(m[1]), subjects: [m[2], m[3]].filter(Boolean).map((s) => SUBJECTS[s!.toLowerCase()]!) }),
  ],
  [/(?:at least )?(\d+) ?ch(?: of (?:university )?courses)?(?: completed)?\b/iy, (m) => ({ type: "creditHours", min: Number(m[1]) })],
  [/enrol(?:l)?ment in (?:the )?([A-Z][A-Za-z]+) program\b/iy, (m) => ({ type: "program", code: m[1]! })],
  // stays a review item, but "X or permission of the instructor" is met by X
  [
    /(?:by )?(?:the )?(?:permission|consent) of (?:the )?(?:instructor|department(?: of [A-Z][a-z]+(?: (?:and|of) [A-Z][a-z]+)*)?)/iy,
    (m) => ({ type: "text", text: m[0] }),
  ],
  [/(?:its )?equivalents?(?: courses?)?\b/iy, () => ({ type: "text", text: "an equivalent course" })],
  [/(and|or)\b/iy, (m) => m[1]!.toLowerCase() as "and" | "or"],
  [/[,()]/y, (m) => m[0] as "," | "(" | ")"],
];

function withGrade(req: Requisite, minGrade: LetterGrade): Requisite {
  if (req.type === "course") return { ...req, minGrade };
  if (req.type === "any") return { ...req, of: req.of.map((r) => withGrade(r, minGrade)) };
  return req;
}

// "(at least B)" and "(or equivalent)" belong to the course just before them
const ASIDE = /\((?:at least ([A-D][+-]?)|or (?:an? )?equivalents?)\)/iy;

function matchAt(re: RegExp, s: string, pos: number): RegExpExecArray | null {
  re.lastIndex = pos;
  return re.exec(s);
}

const isRequisite = (t: Token | undefined): t is Requisite => typeof t === "object" && "type" in t;

function tokenize(s: string): Token[] | null {
  const tokens: Token[] = [];
  let pos = 0;
  for (;;) {
    while (pos < s.length && /\s/.test(s[pos]!)) pos++;
    if (pos === s.length) return tokens;

    const aside = matchAt(ASIDE, s, pos);
    if (aside) {
      const last = tokens.pop();
      if (!isRequisite(last)) return null;
      tokens.push(aside[1] ? withGrade(last, aside[1].toUpperCase() as LetterGrade) : { type: "any", of: [last, { type: "text", text: "an equivalent course" }] });
      pos = ASIDE.lastIndex;
      continue;
    }

    let token: Token | null = null;
    for (const [re, make] of RULES) {
      const m = matchAt(re, s, pos);
      if (m) {
        token = make(m);
        pos = re.lastIndex;
        break;
      }
    }
    if (!token) return null;

    const prev = tokens.at(-1);
    if (typeof prev === "object" && "gradeFor" in prev) {
      if (!isRequisite(token)) return null;
      tokens[tokens.length - 1] = withGrade(token, prev.gradeFor);
    } else {
      tokens.push(token);
    }
  }
}

// One level of a list: items joined by commas and one kind of conjunction. Commas take the
// conjunction ("A, B and C"). Ambiguous without brackets: mixing "and" with "or", and a bare
// comma after a conjunction ("A or B, C or D" could be two groups or one list).
function parseList(tokens: Token[], pos: { i: number }): Requisite | null {
  const items: Requisite[] = [];
  const joins = new Set<"and" | "or">();
  let joined = false;
  while (pos.i < tokens.length) {
    const t = tokens[pos.i++]!;
    if (t === "(") {
      const inner = parseList(tokens, pos);
      if (!inner || tokens[pos.i++] !== ")") return null;
      items.push(inner);
    } else if (isRequisite(t)) {
      items.push(t);
    } else {
      return null;
    }
    const next = tokens[pos.i];
    if (next === undefined || next === ")") break;
    const comma = next === ",";
    if (comma) pos.i++;
    // "A, and B" / "A, or B"
    const join = tokens[pos.i];
    if (join === "and" || join === "or") {
      joins.add(join);
      if (!comma) joined = true;
      pos.i++;
    } else if (joined) {
      return null;
    }
  }
  if (items.length === 0 || joins.size > 1) return null;
  if (items.length === 1) return items[0]!;
  return { type: joins.has("or") ? "any" : "all", of: items };
}

// Separators above a plain list: semicolons, then commas in a list that ends ", and" or
// ", or" (the calendar's "A or B, C or D, and E" is (A or B) and (C or D) and E). The
// conjunction written in the groups joins all of them.
const LEVELS = [/;\s*/, /,\s*/];

function parseText(s: string, level: number): Requisite | null {
  const tokens = tokenize(s);
  const pos = { i: 0 };
  const tree = tokens && parseList(tokens, pos);
  if (tree && pos.i === tokens.length) return tree;
  if (level >= LEVELS.length || s.includes("(")) return null;

  const splits = level === 0 || /,\s*(?:and|or)\b/i.test(s);
  const parts = splits ? s.split(LEVELS[level]!) : [s];
  if (parts.length === 1) return parseText(s, level + 1);
  const joins = new Set<string>();
  const items: Requisite[] = [];
  for (const part of parts) {
    const m = /^(and|or)\s+/i.exec(part);
    if (m) joins.add(m[1]!.toLowerCase());
    const item = parseText(m ? part.slice(m[0].length) : part, level + 1);
    if (!item) return null;
    items.push(item);
  }
  if (joins.size > 1) return null;
  return { type: joins.has("or") ? "any" : "all", of: items };
}

// Notes after the requirement ("NOTE: Credit ...") and "(X recommended)" asides don't change
// it; the rest is filler around a list.
function clean(text: string): string {
  return text
    .split(/(?<=\.)\s+(?=NOTE|Note|Credit)/)[0]!
    .replace(/\s*\([^()]*recommended\)/gi, "")
    .replace(/\b(?:either|both|one of|successful completion of|open to students who have completed)\s+/gi, "")
    .trim()
    .replace(/\.$/, "");
}

export function parseRequisite(text: string): Requisite {
  return parseText(clean(text), 0) ?? { type: "text", text: text.trim() };
}

export interface RequisiteContext {
  attempts: Attempt[];
  // the term the student wants to take the course in; only earlier attempts count
  term: Term;
  // the student's program code ("BCS")
  program: string;
  index: CourseIndex;
  scale: GradingScale;
  // corequisites: a course taken in the same term counts too
  alongside?: boolean;
}

// best to worst
export const REQUISITE_STATUSES: RequisiteStatus[] = ["met", "pending", "review", "missing"];
export const worstRequisite = (s: RequisiteStatus[]) => REQUISITE_STATUSES[Math.max(...s.map((x) => REQUISITE_STATUSES.indexOf(x)))]!;
const best = (s: RequisiteStatus[]) => REQUISITE_STATUSES[Math.min(...s.map((x) => REQUISITE_STATUSES.indexOf(x)))]!;

export function checkRequisite(req: Requisite, ctx: RequisiteContext): RequisiteStatus {
  const counted = ctx.attempts.filter((a) => {
    const c = compareTerms(a.term, ctx.term);
    return c < 0 || (ctx.alongside && c === 0);
  });
  switch (req.type) {
    case "course": {
      const status = (a: Attempt): RequisiteStatus => {
        const passed = req.minGrade ? meetsGrade(a, req.minGrade, ctx.scale) : earnsCredit(a, ctx.scale);
        // CR or TR can't show a letter grade
        if (passed === "unknown") return "review";
        if (passed) return "met";
        if (!isInProgress(a)) return "missing";
        return compareTerms(a.term, ctx.term) === 0 ? "met" : "pending";
      };
      return best([...counted.filter((a) => a.code === req.code).map(status), "missing"]);
    }
    case "creditHours": {
      const inScope = counted.filter((a) => !req.subjects || req.subjects.includes(courseFacts(a.code, ctx.index, a).subject));
      const ch = (list: Attempt[]) => list.reduce((sum, a) => sum + courseFacts(a.code, ctx.index, a).creditHours, 0);
      const earned = ch(inScope.filter((a) => earnsCredit(a, ctx.scale)));
      if (earned >= req.min) return "met";
      return earned + ch(inScope.filter(isInProgress)) >= req.min ? "pending" : "missing";
    }
    case "program":
      return req.code.toUpperCase() === ctx.program.toUpperCase() ? "met" : "missing";
    case "all":
      return worstRequisite(req.of.map((r) => checkRequisite(r, ctx)));
    case "any":
      return best(req.of.map((r) => checkRequisite(r, ctx)));
    case "text":
      return "review";
  }
}

// Prerequisites: the calendar's text ("CS 1083, CS 1543 and (CS 1303 or MATH 2203).") parsed
// into a tree, and checked against a student's record for a given term. Anything the parser
// doesn't understand (instructor permission, program enrolment, grade minimums) stays as text
// and comes out as "review", so a person decides.
import { earnsCredit, isInProgress } from "./grades.ts";
import { courseFacts, type CourseIndex } from "./courses.ts";
import type { Attempt } from "./record.ts";
import type { CourseCode, Term } from "./schema/common.ts";
import type { GradingScale } from "./schema/grades.ts";
import { compareTerms } from "./terms.ts";

export type Requisite =
  | { type: "course"; code: CourseCode }
  | { type: "creditHours"; min: number }
  | { type: "all"; of: Requisite[] }
  | { type: "any"; of: Requisite[] }
  | { type: "text"; text: string };

// met: done before the term; pending: only by courses still in progress or planned before it
export type RequisiteStatus = "met" | "pending" | "missing" | "review";

type Token = Requisite | "and" | "or" | "," | "(" | ")";

const TOKEN =
  /\s*(?:([A-Z]{2,5}) ?(\d{4})|(?:at least )?(\d+) ?ch(?: completed)?\b|(and|or)\b|([,()])|((?:the )?(?:permission|consent) of (?:the )?(?:instructor|department)))/iy;

function tokenize(s: string): Token[] | null {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < s.length) {
    const m = TOKEN.exec(s);
    if (!m) return null;
    if (m[1]) tokens.push({ type: "course", code: `${m[1].toUpperCase()} ${m[2]}` });
    else if (m[3]) tokens.push({ type: "creditHours", min: Number(m[3]) });
    else if (m[4]) tokens.push(m[4].toLowerCase() as "and" | "or");
    else if (m[5]) tokens.push(m[5] as "," | "(" | ")");
    // stays a review item, but "X or permission of the instructor" is met by X
    else tokens.push({ type: "text", text: m[6]! });
  }
  return tokens;
}

// One level of a list: items joined by commas and one kind of conjunction. Commas take the
// conjunction ("A, B and C"); a list mixing "and" with "or" without brackets is ambiguous.
function parseList(tokens: Token[], pos: { i: number }): Requisite | null {
  const items: Requisite[] = [];
  const joins = new Set<"and" | "or">();
  while (pos.i < tokens.length) {
    const t = tokens[pos.i++]!;
    if (t === "(") {
      const inner = parseList(tokens, pos);
      if (!inner || tokens[pos.i++] !== ")") return null;
      items.push(inner);
    } else if (typeof t === "object") {
      items.push(t);
    } else {
      return null;
    }
    const next = tokens[pos.i];
    if (next === undefined || next === ")") break;
    if (next === ",") pos.i++;
    // "A, and B" / "A, or B"
    const join = tokens[pos.i];
    if (join === "and" || join === "or") {
      joins.add(join);
      pos.i++;
    }
  }
  if (items.length === 0 || joins.size > 1) return null;
  if (items.length === 1) return items[0]!;
  return { type: joins.has("or") ? "any" : "all", of: items };
}

// Separators above a plain list: "A; or B" and "A or B, and C or D" (the calendar's way of
// writing (A or B) and (C or D)).
const LEVELS = [/;\s*/, /,\s*(?=(?:and|or)\b)/i];

function parseText(s: string, level: number): Requisite | null {
  const tokens = tokenize(s);
  const pos = { i: 0 };
  const tree = tokens && parseList(tokens, pos);
  if (tree && pos.i === tokens.length) return tree;
  if (level >= LEVELS.length || s.includes("(")) return null;

  const parts = s.split(LEVELS[level]!);
  if (parts.length === 1) return parseText(s, level + 1);
  const joins = new Set<string>();
  const items: Requisite[] = [];
  for (const [i, part] of parts.entries()) {
    const m = /^(and|or)\s+/i.exec(part);
    if (i > 0) joins.add(m ? m[1]!.toLowerCase() : "and");
    const item = parseText(m ? part.slice(m[0].length) : part, level + 1);
    if (!item) return null;
    items.push(item);
  }
  if (joins.size > 1) return null;
  return { type: joins.has("or") ? "any" : "all", of: items };
}

// Notes after the requirement ("NOTE: Credit ...") and "(X recommended)" asides don't change
// it; "either", "both" and "one of" are just filler around a list.
function clean(text: string): string {
  return text
    .split(/(?<=\.)\s+(?=NOTE|Note|Credit)/)[0]!
    .replace(/\s*\([^()]*recommended\)/gi, "")
    .replace(/\b(?:either|both|one of)\s+/gi, "")
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
  index: CourseIndex;
  scale: GradingScale;
}

const RANK: RequisiteStatus[] = ["met", "pending", "review", "missing"];
const worst = (s: RequisiteStatus[]) => RANK[Math.max(...s.map((x) => RANK.indexOf(x)))]!;
const best = (s: RequisiteStatus[]) => RANK[Math.min(...s.map((x) => RANK.indexOf(x)))]!;

export function checkRequisite(req: Requisite, ctx: RequisiteContext): RequisiteStatus {
  const before = ctx.attempts.filter((a) => compareTerms(a.term, ctx.term) < 0);
  switch (req.type) {
    case "course": {
      const tries = before.filter((a) => a.code === req.code);
      if (tries.some((a) => earnsCredit(a, ctx.scale))) return "met";
      return tries.some(isInProgress) ? "pending" : "missing";
    }
    case "creditHours": {
      const ch = (list: Attempt[]) => list.reduce((sum, a) => sum + courseFacts(a.code, ctx.index, a).creditHours, 0);
      const earned = ch(before.filter((a) => earnsCredit(a, ctx.scale)));
      if (earned >= req.min) return "met";
      return earned + ch(before.filter(isInProgress)) >= req.min ? "pending" : "missing";
    }
    case "all":
      return worst(req.of.map((r) => checkRequisite(r, ctx)));
    case "any":
      return best(req.of.map((r) => checkRequisite(r, ctx)));
    case "text":
      return "review";
  }
}

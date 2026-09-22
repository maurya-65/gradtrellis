import type { Result } from "../api/client.ts";
import { compareTerms, SEASONS, termOn, type Term } from "backend/engine/terms";

// entry term through next year, newest first
export function termOptions(entry: Term, now = new Date()): Term[] {
  const out: Term[] = [];
  for (let year = entry.year; year <= now.getFullYear() + 1; year++) {
    for (const season of SEASONS) {
      const t = { season, year };
      if (compareTerms(t, entry) >= 0) out.push(t);
    }
  }
  return out.reverse();
}

export const RESULTS = [
  { value: "IP", label: "In progress" },
  { value: "A+", label: "A+" },
  { value: "A", label: "A" },
  { value: "A-", label: "A-" },
  { value: "B+", label: "B+" },
  { value: "B", label: "B" },
  { value: "B-", label: "B-" },
  { value: "C+", label: "C+" },
  { value: "C", label: "C" },
  { value: "D", label: "D" },
  { value: "F", label: "F" },
  { value: "W", label: "W (withdrawn)" },
  { value: "WF", label: "WF (withdrawn failing)" },
  { value: "CR", label: "CR (credit)" },
  { value: "NCR", label: "NCR (no credit)" },
  { value: "TR", label: "Transfer credit" },
] as const;

// IP is UNB's code for "no grade yet"; before the term starts, that's a planned course
function isPlanned(term: Term, now = new Date()): boolean {
  return compareTerms(term, termOn(now)) > 0;
}

// A planned course can't have a grade yet. A course in the current term stays in progress
// until results come out, but those can arrive before the term ends (Fall grades land in
// late December), so grades are still offered.
export function resultOptions(term: Term): Array<{ value: Result; label: string }> {
  if (isPlanned(term)) return [{ value: "IP", label: "Planned" }];
  return RESULTS.map((r) => ({ value: r.value, label: r.value === "IP" ? "In progress" : r.label }));
}

// what a new course starts as: in progress (or planned) unless its term is over
export function defaultResult(term: Term, now = new Date()): Result | null {
  return compareTerms(term, termOn(now)) >= 0 ? "IP" : null;
}

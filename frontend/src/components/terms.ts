import { compareTerms, SEASONS, type Term } from "backend/engine/terms";

export function currentTerm(now = new Date()): Term {
  const m = now.getMonth();
  return { season: m < 4 ? "Winter" : m < 8 ? "Summer" : "Fall", year: now.getFullYear() };
}

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

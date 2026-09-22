// No zod here: the frontend imports this file.

export type Season = "Winter" | "Summer" | "Fall";

// Winter (Jan-Apr), Summer (May-Aug), Fall (Sep-Dec)
export interface Term {
  year: number;
  season: Season;
}

export const SEASONS: Season[] = ["Winter", "Summer", "Fall"];

export function compareTerms(a: Term, b: Term): number {
  return a.year * 3 + SEASONS.indexOf(a.season) - (b.year * 3 + SEASONS.indexOf(b.season));
}

export function termLabel(t: Term): string {
  return `${t.season} ${t.year}`;
}

// Winter is Jan-Apr, Summer May-Aug, Fall Sep-Dec
export function termOn(date: Date): Term {
  const month = date.getMonth();
  return { season: month < 4 ? "Winter" : month < 8 ? "Summer" : "Fall", year: date.getFullYear() };
}

// Fall 2024, Winter 2025 and Summer 2025 are all "2024-2025"
export function calendarYearOf(t: Term): string {
  const start = t.season === "Fall" ? t.year : t.year - 1;
  return `${start}-${start + 1}`;
}

export function nextTerm(t: Term): Term {
  const i = SEASONS.indexOf(t.season);
  return i === SEASONS.length - 1 ? { season: SEASONS[0]!, year: t.year + 1 } : { season: SEASONS[i + 1]!, year: t.year };
}

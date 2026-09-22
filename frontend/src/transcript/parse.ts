import type { Result, Season } from "../api/client.ts";

// Parses the UNB unofficial transcript (the PDF from myUNB). Each line comes in as
// cells: the text between wide horizontal gaps, so a missing grade is an empty column
// rather than a guess. Anything that isn't a term heading or a course line (names,
// GPA summaries, standing notes, awards) is ignored.

export interface ParsedAttempt {
  code: string;
  term: { season: Season; year: number };
  result: Result;
  creditHours: number;
  title: string;
}

export interface ParsedTranscript {
  attempts: ParsedAttempt[];
  // course lines we couldn't read, shown to the student so nothing disappears silently
  unreadable: string[];
}

const TERM = /^(\d{4})\/(FA|WI|SM)$/;
const COURSE = /^([A-Z]{2,5})\*(\d{4})$/;
const HOURS = /^\d+\.\d{2}$/;
const SEASONS: Record<string, Season> = { FA: "Fall", WI: "Winter", SM: "Summer" };
const RESULTS = new Set(["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D", "F", "WF", "CR", "NCR", "W", "INC", "AEG", "AUD", "CTN", "IP", "TR"]);

export function parseTranscript(lines: string[][]): ParsedTranscript {
  const attempts: ParsedAttempt[] = [];
  const unreadable: string[] = [];
  let term: ParsedAttempt["term"] | null = null;

  for (const cells of lines) {
    const termMatch = TERM.exec(cells[0] ?? "");
    if (termMatch) {
      term = { season: SEASONS[termMatch[2]!]!, year: Number(termMatch[1]) };
      continue;
    }

    const codeMatch = COURSE.exec(cells[0] ?? "");
    if (!codeMatch) continue;

    const [, title = "", ...rest] = cells;
    // registered courses have no grade yet, so the hours come straight after the title
    const grade = HOURS.test(rest[0] ?? "") ? null : normalizeGrade(rest.shift() ?? "");
    const hours = rest[0];

    if (!term || !hours || !HOURS.test(hours) || (grade !== null && !RESULTS.has(grade))) {
      unreadable.push(cells.join("  "));
      continue;
    }
    attempts.push({
      code: `${codeMatch[1]} ${codeMatch[2]}`,
      term,
      result: (grade ?? "IP") as Result,
      creditHours: Number(hours),
      title,
    });
  }

  return { attempts, unreadable };
}

// PDFs sometimes use a real minus sign or dash in A- and B-
function normalizeGrade(raw: string): string {
  return raw.replace(/[−–—]/g, "-");
}

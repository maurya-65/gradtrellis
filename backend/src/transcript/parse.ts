// Parses the UNB unofficial transcript (the PDF from myUNB). Shared: the frontend uses it
// to preview an import, the server to verify the student number. No Node or DOM imports.
import type { Result } from "../engine/schema/grades.ts";
import type { Season } from "../engine/terms.ts";

// a run of text as pdf.js reports it (transform[4] is x, transform[5] is y)
export interface TextRun {
  str: string;
  transform: number[];
  width: number;
}

export interface ParsedAttempt {
  code: string;
  term: { season: Season; year: number };
  result: Result;
  creditHours: number;
  title: string;
}

export interface ParsedTranscript {
  // from the header: the 7-digit student number and the name as printed ("Lastname, Firstnames")
  student: { number: string; name: string } | null;
  attempts: ParsedAttempt[];
  // course lines we couldn't read, shown to the student so nothing disappears silently
  unreadable: string[];
}

// Anything wider than a couple of spaces separates two columns.
const COLUMN_GAP = 10;

// Groups one page's text into lines of cells: the text between wide horizontal gaps,
// so a missing grade is an empty column rather than a guess.
export function toLines(runs: TextRun[]): string[][] {
  const rows = new Map<number, TextRun[]>();
  for (const run of runs) {
    if (!run.str.trim()) continue;
    const y = Math.round(run.transform[5]!);
    rows.set(y, [...(rows.get(y) ?? []), run]);
  }

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => {
      row.sort((a, b) => a.transform[4]! - b.transform[4]!);
      const cells: string[] = [];
      let end = -Infinity;
      for (const run of row) {
        const x = run.transform[4]!;
        if (x - end > COLUMN_GAP || cells.length === 0) cells.push(run.str);
        else cells[cells.length - 1] += ` ${run.str}`;
        end = x + run.width;
      }
      return cells;
    });
}

const STUDENT = /^\d{7}$/;
const TERM = /^(\d{4})\/(FA|WI|SM)$/;
const COURSE = /^([A-Z]{2,5})\*(\d{4})$/;
const HOURS = /^\d+\.\d{2}$/;
const SEASONS: Record<string, Season> = { FA: "Fall", WI: "Winter", SM: "Summer" };
const RESULTS = new Set(["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D", "F", "WF", "CR", "NCR", "W", "INC", "AEG", "AUD", "CTN", "IP", "TR"]);

// Anything that isn't the header, a term heading or a course line (GPA summaries,
// standing notes, awards) is ignored.
export function parseTranscript(lines: string[][]): ParsedTranscript {
  let student: ParsedTranscript["student"] = null;
  const attempts: ParsedAttempt[] = [];
  const unreadable: string[] = [];
  let term: ParsedAttempt["term"] | null = null;

  for (const cells of lines) {
    const first = cells[0] ?? "";

    // the header repeats on every page; the first one is enough
    if (!student && STUDENT.test(first) && cells[1]?.includes(",")) {
      student = { number: first, name: cells[1] };
      continue;
    }

    const termMatch = TERM.exec(first);
    if (termMatch) {
      term = { season: SEASONS[termMatch[2]!]!, year: Number(termMatch[1]) };
      continue;
    }

    const codeMatch = COURSE.exec(first);
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

  return { student, attempts, unreadable };
}

// PDFs sometimes use a real minus sign or dash in A- and B-
function normalizeGrade(raw: string): string {
  return raw.replace(/[−–—]/g, "-");
}

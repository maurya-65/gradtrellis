import { z } from "zod";

export const CourseCode = z
  .string()
  .regex(/^[A-Z]{2,5} \d{4}$/, "expected a course code like 'CS 1073'");
export type CourseCode = z.infer<typeof CourseCode>;

// "cs1073" -> "CS 1073"
export function normalizeCourseCode(raw: string): CourseCode | null {
  const m = /^\s*([A-Za-z]{2,5})\s*(\d{4})\s*$/.exec(raw);
  return m ? `${m[1]!.toUpperCase()} ${m[2]}` : null;
}

export function subjectOf(code: CourseCode): string {
  return code.slice(0, code.indexOf(" "));
}

export function levelOf(code: CourseCode): number {
  return Number(code.charAt(code.indexOf(" ") + 1));
}

export const Season = z.enum(["Winter", "Summer", "Fall"]);

export const Term = z.object({
  year: z.number().int().min(1990).max(2100),
  season: Season,
});
export type Term = z.infer<typeof Term>;

export const CalendarYear = z.string().regex(/^\d{4}-\d{4}$/);

// Where a rule came from, so every audit answer can be checked.
export const SourceRef = z.object({
  document: z.string(),
  url: z.url(),
  section: z.string().optional(),
  // printed page number, not the PDF page
  page: z.number().int().optional(),
  quote: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

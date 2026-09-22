import type { Program } from "./schema/program.ts";
import type { StudentRecord } from "./record.ts";
import { calendarYearOf } from "./terms.ts";

// Rules come from the year the student entered. If that year isn't encoded, fall back
// to the closest earlier one and say so (exact: false).
export function programForEntry(programs: Program[], ref: StudentRecord["program"]): { program: Program; exact: boolean } {
  const entryYear = calendarYearOf(ref.entry);
  const candidates = programs
    .filter((p) => p.institution === ref.institution && p.campus === ref.campus && p.code === ref.code)
    .sort((a, b) => a.calendarYear.localeCompare(b.calendarYear));
  if (candidates.length === 0) throw new Error(`no encoded calendar for ${ref.institution}/${ref.campus}/${ref.code}`);

  const exact = candidates.find((p) => p.calendarYear === entryYear);
  if (exact) return { program: exact, exact: true };
  const earlier = candidates.filter((p) => p.calendarYear < entryYear).at(-1);
  return { program: earlier ?? candidates[0]!, exact: false };
}

import { LetterGrade, type GradingScale, type Result } from "./schema/grades.ts";
import type { Attempt } from "./record.ts";

const LETTERS = LetterGrade.options;

export function isLetter(r: Result): r is LetterGrade {
  return (LETTERS as readonly string[]).includes(r);
}

export function gradeAtLeast(result: Result, min: LetterGrade, scale: GradingScale): boolean {
  if (!isLetter(result)) return false;
  return scale.points[result]! >= scale.points[min]!;
}

// D or better (or CR/TR) earns credit at the university level
export function earnsCredit(a: Attempt, scale: GradingScale): boolean {
  if (a.notations.includes("X")) return false;
  if (isLetter(a.result)) return gradeAtLeast(a.result, scale.minimumCreditGrade, scale);
  return (scale.creditWithoutPoints as readonly string[]).includes(a.result);
}

// CR/TR can't prove a letter grade, hence "unknown"
export function meetsGrade(a: Attempt, min: LetterGrade, scale: GradingScale): boolean | "unknown" {
  if (a.notations.includes("X")) return false;
  if (isLetter(a.result)) return gradeAtLeast(a.result, min, scale);
  if ((scale.creditWithoutPoints as readonly string[]).includes(a.result)) return "unknown";
  return false;
}

export function isInProgress(a: Attempt): boolean {
  return a.result === "IP" || a.result === "CTN" || a.result === "INC";
}

export interface GpaResult {
  value: number | null;
  // one decimal, like the transcript
  display: string;
  attemptedCreditHours: number;
  gradePoints: number;
}

// Calendar section B: every attempt counts (repeats too), F/WF count as 0,
// W/CR/NCR/in-progress and X/# notations are left out.
export function gpa(attempts: Iterable<Attempt>, creditHoursOf: (a: Attempt) => number, scale: GradingScale): GpaResult {
  let hours = 0;
  let points = 0;
  for (const a of attempts) {
    if (!isLetter(a.result)) continue;
    if ((scale.excludedFromGpa as readonly string[]).includes(a.result)) continue;
    if (a.notations.includes("X") || a.notations.includes("#")) continue;
    const ch = creditHoursOf(a);
    hours += ch;
    points += ch * scale.points[a.result]!;
  }
  const value = hours > 0 ? points / hours : null;
  return {
    value,
    display: value === null ? "—" : (Math.round(value * 10 + 1e-9) / 10).toFixed(1),
    attemptedCreditHours: hours,
    gradePoints: points,
  };
}

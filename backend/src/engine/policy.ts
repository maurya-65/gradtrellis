import type { CourseCode } from "./schema/common.ts";
import type { GradingScale } from "./schema/grades.ts";
import type { Program } from "./schema/program.ts";
import { courseFacts, type CourseIndex } from "./courses.ts";
import { gpa, type GpaResult } from "./grades.ts";
import type { Attempt, StudentRecord } from "./record.ts";

// withdrawals count toward the limit of 3, # attempts don't
export function attemptCount(record: StudentRecord, code: CourseCode, scale: GradingScale): number {
  return record.attempts.filter(
    (a) => a.code === code && !a.notations.includes("#") && (scale.countsAsAttempt as readonly string[]).includes(a.result),
  ).length;
}

// for the BCS three-fail rule; 0 for calendars that don't have one
export function failCount(record: StudentRecord, code: CourseCode, program: Program): number {
  const failLimit = program.policies.failLimit;
  if (!failLimit) return 0;
  return record.attempts.filter(
    (a) =>
      a.code === code &&
      !a.notations.includes("#") &&
      !a.notations.includes("X") &&
      (failLimit.results as readonly string[]).includes(a.result),
  ).length;
}

export interface PolicyWarning {
  level: "info" | "warning" | "critical";
  code: string;
  message: string;
  course?: CourseCode | undefined;
}

export function policyWarnings(record: StudentRecord, program: Program, index: CourseIndex, scale: GradingScale): PolicyWarning[] {
  const out: PolicyWarning[] = [];
  const failLimit = program.policies.failLimit;
  const limit = failLimit?.count ?? Infinity;

  for (const code of new Set(record.attempts.map((a) => a.code))) {
    const fails = failCount(record, code, program);
    if (failLimit && fails >= limit) {
      out.push({
        level: "critical",
        code: "fail-limit-reached",
        course: code,
        message: `${fails} failing grades in ${code}. ${failLimit.consequence}, subject to Faculty review.`,
      });
    } else if (failLimit && fails === limit - 1) {
      out.push({
        level: "warning",
        code: "fail-limit-near",
        course: code,
        message: `${fails} failing grades in ${code} (D, F, WF and NCR count). One more means ${failLimit.consequence.toLowerCase()}.`,
      });
    }

    const attempts = attemptCount(record, code, scale);
    if (attempts >= scale.maxAttempts) {
      out.push({
        level: "warning",
        code: "max-attempts",
        course: code,
        message: `${attempts} attempts at ${code} (withdrawals included). Registering again needs the Dean's permission.`,
      });
    }
  }

  const c = cumulativeGpa(record, index, scale);
  const reduced = program.policies.load.reducedLoad;
  if (c.value !== null && c.value < reduced.gpaBelow) {
    out.push({
      level: "warning",
      code: "reduced-load",
      message: `CGPA ${c.display} is below ${reduced.gpaBelow}. The calendar says to take ${reduced.maxCourses} courses or fewer per term.`,
    });
  }
  return out;
}

export function cumulativeGpa(record: StudentRecord, index: CourseIndex, scale: GradingScale): GpaResult {
  return gpa(record.attempts, (a: Attempt) => courseFacts(a.code, index, a).creditHours, scale);
}

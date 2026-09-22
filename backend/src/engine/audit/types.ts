import type { CourseCode, SourceRef, Term } from "../schema/common.ts";
import type { Program } from "../schema/program.ts";
import type { CourseFacts } from "../courses.ts";
import type { Attempt } from "../record.ts";
import type { PolicyWarning } from "../policy.ts";

// Best attempt at a course; repeats count once.
export interface UsableCourse {
  code: CourseCode;
  facts: CourseFacts;
  attempt: Attempt;
  // planned = registered for a term that hasn't started yet
  state: "completed" | "in-progress" | "planned";
  // 2 for 6 ch courses
  weight: number;
  notes: string[];
}

export interface NotCounted {
  code: CourseCode;
  term: Term;
  result: string;
  reason: string;
}

// in-progress/planned = met once the current/future courses are passed;
// review = only satisfied if someone at the Faculty confirms something
export type RequirementStatus = "complete" | "in-progress" | "planned" | "incomplete" | "review";

export interface UsedCourse {
  code: CourseCode;
  state: UsableCourse["state"];
  creditHours: number;
  weight: number;
  note?: string | undefined;
}

export interface ConstraintResult {
  id: string;
  title: string;
  status: RequirementStatus;
  have: number;
  need: number;
  unit: "courses" | "ch";
  // the courses in this requirement that count toward the constraint
  courses: CourseCode[];
}

export interface RequirementResult {
  id: string;
  title: string;
  kind: "course" | "allOf" | "oneOf" | "pool" | "cgpa";
  status: RequirementStatus;
  remaining: string;
  used: UsedCourse[];
  // beyond the minimum
  surplus?: UsedCourse[] | undefined;
  // pools: running totals against the pool's minimums, e.g. 8 of 10 courses
  progress?: Array<{ unit: "courses" | "ch"; have: number; need: number }> | undefined;
  constraints?: ConstraintResult[] | undefined;
  couldCountWithApproval?: Array<{ code: CourseCode; by: string }> | undefined;
  chosenOption?: string | undefined;
  children?: RequirementResult[] | undefined;
  source?: SourceRef | undefined;
  notes: string[];
}

export interface DesignationResult {
  id: string;
  name: string;
  status: RequirementStatus;
  requirements: RequirementResult[];
  tier?: string | undefined;
  notes: string[];
}

export interface Totals {
  courses: { have: number; inProgress: number; planned: number; need: number };
  creditHours: { have: number; inProgress: number; planned: number; need: number };
  status: RequirementStatus;
}

export interface AuditResult {
  studentId: string;
  program: Pick<Program, "id" | "name" | "calendarYear">;
  // false if we fell back to a different calendar year
  exactCalendar: boolean;
  status: RequirementStatus;
  cgpa: string;
  totals: Totals;
  requirements: RequirementResult[];
  overlays: RequirementResult[];
  designations: DesignationResult[];
  notCounted: NotCounted[];
  warnings: PolicyWarning[];
  interpretations: Array<{ requirement: string; note: string }>;
}

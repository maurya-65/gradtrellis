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
  state: "completed" | "in-progress";
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

// review = only satisfied if someone at the Faculty confirms something
export type RequirementStatus = "complete" | "in-progress" | "incomplete" | "review";

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
  courses: { have: number; inProgress: number; need: number };
  creditHours: { have: number; inProgress: number; need: number };
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

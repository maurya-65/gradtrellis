import { z } from "zod";
import { CalendarYear, CourseCode, SourceRef } from "./common.ts";
import { LetterGrade, Result } from "./grades.ts";

export type CourseFlag = "programming" | "writing" | "experiential";

export type Selector =
  | { type: "codes"; codes: CourseCode[] }
  | { type: "subjects"; subjects: string[] }
  | { type: "level"; min?: number | undefined; max?: number | undefined }
  | { type: "flag"; flag: CourseFlag }
  | { type: "minCreditHours"; min: number }
  | { type: "anyCourse" }
  | { type: "all"; of: Selector[] }
  | { type: "any"; of: Selector[] }
  | { type: "not"; of: Selector };

export const Selector: z.ZodType<Selector> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("codes"), codes: z.array(CourseCode).min(1) }),
    z.object({ type: z.literal("subjects"), subjects: z.array(z.string()).min(1) }),
    z.object({
      type: z.literal("level"),
      min: z.number().int().optional(),
      max: z.number().int().optional(),
    }),
    z.object({ type: z.literal("flag"), flag: z.enum(["programming", "writing", "experiential"]) }),
    z.object({ type: z.literal("minCreditHours"), min: z.number() }),
    z.object({ type: z.literal("anyCourse") }),
    z.object({ type: z.literal("all"), of: z.array(Selector).min(1) }),
    z.object({ type: z.literal("any"), of: z.array(Selector).min(1) }),
    z.object({ type: z.literal("not"), of: Selector }),
  ]),
);

// "at least N of the pool's courses must also match `select`"
export const PoolConstraint = z.object({
  id: z.string(),
  title: z.string(),
  select: Selector,
  minCourses: z.number().int().positive().optional(),
  minCreditHours: z.number().positive().optional(),
  source: SourceRef.optional(),
});
export type PoolConstraint = z.infer<typeof PoolConstraint>;

// Courses that count only with someone's sign-off. Never assumed.
export const ApprovalRule = z.object({
  select: Selector,
  by: z.string(),
  note: z.string().optional(),
});
export type ApprovalRule = z.infer<typeof ApprovalRule>;

export type Requirement =
  | {
      type: "course";
      id: string;
      code: CourseCode;
      minGrade?: LetterGrade | undefined;
      // e.g. a renumbered course; confirmed: false means it's our reading and gets flagged
      acceptAlso?: { codes: CourseCode[]; reason: string; confirmed: boolean } | undefined;
      source?: SourceRef | undefined;
    }
  | {
      type: "allOf";
      id: string;
      title: string;
      items: Requirement[];
      source?: SourceRef | undefined;
    }
  | {
      type: "oneOf";
      id: string;
      title: string;
      options: Requirement[];
      source?: SourceRef | undefined;
    }
  | {
      // technical electives, breadth, free electives...
      type: "pool";
      id: string;
      title: string;
      select: Selector;
      minCourses?: number | undefined;
      minCreditHours?: number | undefined;
      sixChCountsAsTwo?: boolean | undefined;
      constraints?: PoolConstraint[] | undefined;
      approval?: ApprovalRule[] | undefined;
      source?: SourceRef | undefined;
    }
  | {
      type: "cgpa";
      id: string;
      title: string;
      min: number;
      source?: SourceRef | undefined;
    };

export const Requirement: z.ZodType<Requirement> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("course"),
      id: z.string(),
      code: CourseCode,
      minGrade: LetterGrade.optional(),
      acceptAlso: z
        .object({ codes: z.array(CourseCode).min(1), reason: z.string(), confirmed: z.boolean() })
        .optional(),
      source: SourceRef.optional(),
    }),
    z.object({
      type: z.literal("allOf"),
      id: z.string(),
      title: z.string(),
      items: z.array(Requirement).min(1),
      source: SourceRef.optional(),
    }),
    z.object({
      type: z.literal("oneOf"),
      id: z.string(),
      title: z.string(),
      options: z.array(Requirement).min(2),
      source: SourceRef.optional(),
    }),
    z.object({
      type: z.literal("pool"),
      id: z.string(),
      title: z.string(),
      select: Selector,
      minCourses: z.number().int().positive().optional(),
      minCreditHours: z.number().positive().optional(),
      sixChCountsAsTwo: z.boolean().optional(),
      constraints: z.array(PoolConstraint).optional(),
      approval: z.array(ApprovalRule).optional(),
      source: SourceRef.optional(),
    }),
    z.object({
      type: z.literal("cgpa"),
      id: z.string(),
      title: z.string(),
      min: z.number(),
      source: SourceRef.optional(),
    }),
  ]),
);

// e.g. Honours tightening the technical elective rules
export const PoolPatch = z.object({
  pool: z.string(),
  // same id replaces the base constraint
  constraints: z.array(PoolConstraint).optional(),
  mustInclude: z
    .array(z.object({ code: CourseCode, minGrade: LetterGrade.optional() }))
    .optional(),
});
export type PoolPatch = z.infer<typeof PoolPatch>;

export const Designation = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["honours", "specialization", "minor", "option"]),
  // checked on top of the degree; doesn't use up its courses
  requirements: z.array(Requirement),
  patches: z.array(PoolPatch).optional(),
  // highest first
  tiers: z.array(z.object({ label: z.string(), minCgpa: z.number() })).optional(),
  compatibleWith: z.array(z.string()).optional(),
  source: SourceRef,
});
export type Designation = z.infer<typeof Designation>;

export const FailLimitPolicy = z.object({
  count: z.number().int(),
  results: z.array(Result),
  consequence: z.string(),
  source: SourceRef,
});

export const LoadPolicy = z.object({
  typicalCoursesPerTerm: z.tuple([z.number().int(), z.number().int()]),
  standardStudyTerms: z.number().int(),
  reducedLoad: z.object({ gpaBelow: z.number(), maxCourses: z.number().int() }),
  source: SourceRef,
});

export const Program = z.object({
  id: z.string(),
  institution: z.string(),
  campus: z.string(),
  code: z.string(),
  name: z.string(),
  calendarYear: CalendarYear,
  source: SourceRef,
  minGrade: LetterGrade,
  totals: z.object({
    minCourses: z.number().int(),
    minCreditHours: z.number(),
    source: SourceRef,
  }),
  nonCredit: z.object({ codes: z.array(CourseCode), source: SourceRef }),
  // "credit is given for only one of"
  creditExclusions: z.array(z.object({ codes: z.array(CourseCode).min(2), source: SourceRef })),
  // each course fills at most one of these
  requirements: z.array(Requirement),
  // may reuse courses from `requirements` (e.g. the writing requirement)
  overlays: z.array(Requirement),
  designations: z.array(Designation),
  policies: z.object({
    failLimit: FailLimitPolicy,
    load: LoadPolicy,
  }),
  // spots where the calendar is ambiguous and we made a call
  interpretationNotes: z.array(z.object({ requirement: z.string(), note: z.string() })),
});
export type Program = z.infer<typeof Program>;

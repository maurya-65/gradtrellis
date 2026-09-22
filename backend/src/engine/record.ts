import { z } from "zod";
import { CourseCode, Term } from "./schema/common.ts";
import { Notation, Result } from "./schema/grades.ts";

// One course in one term; repeats are separate attempts. creditHours is only needed
// for courses missing from the current listings (retired, transfer).
export const Attempt = z.object({
  code: CourseCode,
  term: Term,
  result: Result,
  notations: z.array(Notation).default([]),
  creditHours: z.number().min(0).optional(),
  title: z.string().optional(),
});
export type Attempt = z.infer<typeof Attempt>;

export const StudentRecord = z.object({
  id: z.string(),
  program: z.object({
    institution: z.string(),
    campus: z.string(),
    code: z.string(),
    // decides which calendar's rules apply
    entry: Term,
  }),
  designations: z.array(z.string()).default([]),
  attempts: z.array(Attempt),
});
export type StudentRecord = z.infer<typeof StudentRecord>;
export type StudentRecordInput = z.input<typeof StudentRecord>;

import { z } from "zod";
import { CourseCode, SourceRef } from "./common.ts";

export const CreditRestriction = z.object({
  programs: z.array(z.string()).min(1),
  // "... beyond first year"
  exceptInFirstYear: z.boolean(),
  text: z.string(),
});
export type CreditRestriction = z.infer<typeof CreditRestriction>;

export const Course = z.object({
  code: CourseCode,
  subject: z.string(),
  level: z.number().int().min(0).max(9),
  title: z.string(),
  creditHours: z.number().min(0),
  // as printed, e.g. "4 ch (3C 1.5L 1T) (P)"
  creditText: z.string(),
  flags: z.object({
    // (P), (W), (EL) markers from the calendar
    programming: z.boolean(),
    writing: z.boolean(),
    experiential: z.boolean(),
  }),
  description: z.string(),
  creditRestrictions: z.array(CreditRestriction),
  // "credit will be given for only one of ..."
  creditExclusions: z.array(CourseCode),
  // raw calendar text; parsing it is M2 work
  prereqText: z.string().nullable(),
  coreqText: z.string().nullable(),
  source: SourceRef,
});
export type Course = z.infer<typeof Course>;

export const CourseSnapshot = z.object({
  institution: z.string(),
  campus: z.string(),
  calendarYear: z.string(),
  retrievedAt: z.iso.datetime(),
  subjects: z.array(z.string()),
  courses: z.array(Course),
});
export type CourseSnapshot = z.infer<typeof CourseSnapshot>;

import { z } from "zod";

export const LetterGrade = z.enum(["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D", "F", "WF"]);
export type LetterGrade = z.infer<typeof LetterGrade>;

// IP (in progress) and TR (transfer credit) are ours, not UNB notations.
export const OtherResult = z.enum(["CR", "NCR", "W", "INC", "AEG", "AUD", "CTN", "IP", "TR"]);
export type OtherResult = z.infer<typeof OtherResult>;

export const Result = z.union([LetterGrade, OtherResult]);
export type Result = z.infer<typeof Result>;

// X = extra to the program, # = excluded from GPA after an appeal
export const Notation = z.enum(["X", "#"]);
export type Notation = z.infer<typeof Notation>;

export const GradingScale = z.object({
  institution: z.string(),
  source: z.object({ document: z.string(), url: z.url(), page: z.number().int().optional() }),
  notes: z.array(z.string()).default([]),
  points: z.record(LetterGrade, z.number()),
  minimumCreditGrade: LetterGrade,
  failingResults: z.array(Result),
  creditWithoutPoints: z.array(OtherResult),
  excludedFromGpa: z.array(Result),
  countsAsAttempt: z.array(Result),
  maxAttempts: z.number().int(),
});
export type GradingScale = z.infer<typeof GradingScale>;

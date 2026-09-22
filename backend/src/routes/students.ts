import { Router, type Response } from "express";
import { z } from "zod";
import { courseIndex, gradingScale, programs } from "../catalog.ts";
import { Attempt, normalizeCourseCode, runAudit, StudentRecord, Term } from "../engine/index.ts";
import { addAttempt, createStudent, deleteAttempt, getStudent, replaceAttempts, updateDesignations } from "../queries/students.ts";

// accepts "cs1073" as well as "CS 1073"
const CourseCodeInput = z.string().transform((s, ctx) => {
  const code = normalizeCourseCode(s);
  if (!code) {
    ctx.addIssue({ code: "custom", message: "expected a course code like 'CS 1073'" });
    return z.NEVER;
  }
  return code;
});

// UNB Fredericton BCS is the only program encoded so far
const CreateBody = z.object({
  program: z.object({
    institution: z.string().default("unb"),
    campus: z.string().default("fredericton"),
    code: z.string().default("BCS"),
    entry: Term,
  }),
  designations: z.array(z.string()).default([]),
});

const UpdateBody = z.object({
  designations: z.array(z.string()),
});

const AttemptBody = Attempt.extend({
  code: CourseCodeInput,
  creditHours: z.number().min(0).max(12).optional(),
  title: z.string().max(200).optional(),
});

const ReplaceBody = z.object({
  attempts: z.array(AttemptBody).max(200),
});

// Unlisted courses (retired, transfer) need their credit hours or the audit can't count them.
function missingCreditHours(attempts: z.infer<typeof AttemptBody>[]): string | null {
  const missing = attempts.filter((a) => !courseIndex.has(a.code) && a.creditHours === undefined).map((a) => a.code);
  if (missing.length === 0) return null;
  return `${[...new Set(missing)].join(", ")} ${missing.length === 1 ? "isn't" : "aren't"} in the current calendar; include credit hours`;
}

function notFound(res: Response, what = "student") {
  res.status(404).json({ error: { message: `${what} not found` } });
}

export const studentsRouter = Router();

studentsRouter.post("/", async (req, res) => {
  const body = CreateBody.parse(req.body);
  res.status(201).json({ student: await createStudent(body.program, body.designations) });
});

studentsRouter.get("/:id", async (req, res) => {
  const student = await getStudent(req.params.id);
  if (!student) return notFound(res);
  res.json({ student });
});

studentsRouter.patch("/:id", async (req, res) => {
  const { designations } = UpdateBody.parse(req.body);
  const student = await updateDesignations(req.params.id, designations);
  if (!student) return notFound(res);
  res.json({ student });
});

studentsRouter.post("/:id/attempts", async (req, res) => {
  const attempt = AttemptBody.parse(req.body);
  const missing = missingCreditHours([attempt]);
  if (missing) {
    res.status(400).json({ error: { message: missing } });
    return;
  }
  const saved = await addAttempt(req.params.id, attempt);
  if (!saved) return notFound(res);
  res.status(201).json({ attempt: saved });
});

// transcript import: replaces every attempt
studentsRouter.put("/:id/attempts", async (req, res) => {
  const { attempts } = ReplaceBody.parse(req.body);
  const missing = missingCreditHours(attempts);
  if (missing) {
    res.status(400).json({ error: { message: missing } });
    return;
  }
  const student = await replaceAttempts(req.params.id, attempts);
  if (!student) return notFound(res);
  res.json({ student });
});

studentsRouter.delete("/:id/attempts/:attemptId", async (req, res) => {
  const deleted = await deleteAttempt(req.params.id, req.params.attemptId);
  if (!deleted) return notFound(res, "attempt");
  res.status(204).end();
});

studentsRouter.get("/:id/audit", async (req, res) => {
  const student = await getStudent(req.params.id);
  if (!student) return notFound(res);
  const audit = runAudit(StudentRecord.parse(student), { programs, index: courseIndex, scale: gradingScale });
  res.json({ audit });
});

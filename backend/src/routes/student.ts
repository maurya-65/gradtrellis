import express, { Router, type Response } from "express";
import { z } from "zod";
import { requireUser } from "../auth.ts";
import { courseIndex, gradingScale, programs } from "../catalog.ts";
import { appUrl, sendEmail } from "../email.ts";
import {
  Attempt,
  checkRequisite,
  nextTerm,
  normalizeCourseCode,
  parseRequisite,
  Result,
  runAudit,
  StudentRecord,
  Term,
  termOn,
} from "../engine/index.ts";
import {
  addAttempt,
  createStudent,
  deleteAttempt,
  getStudent,
  replaceAttempts,
  saveTranscript,
  studentIdForUser,
  updateAttemptResult,
  updateDesignations,
} from "../queries/students.ts";
import { emailMatches, fullName, nameMatches } from "../names.ts";
import { getUser, verifyUser } from "../queries/users.ts";
import { readTranscript } from "../transcript/read.ts";

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

const ResultBody = z.object({ result: Result });

// ?courses=CS 3383,CS 3413&term=Winter 2027 (term defaults to the next one)
const EligibilityQuery = z.object({
  courses: z
    .string()
    .transform((s) => s.split(","))
    .pipe(z.array(CourseCodeInput).min(1).max(50)),
  term: z
    .string()
    .regex(/^(Winter|Summer|Fall) \d{4}$/, "expected a term like 'Winter 2027'")
    .transform((s) => {
      const [season, year] = s.split(" ");
      return Term.parse({ season, year: Number(year) });
    })
    .optional(),
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

// The logged-in user's profile id. Answers 404 (and returns null) if they haven't set one up.
async function ownStudentId(res: Response): Promise<string | null> {
  const id = await studentIdForUser(res.locals.userId as string);
  if (!id) res.status(404).json({ error: { message: "set up your profile first" } });
  return id;
}

// Everything here is the logged-in user's own profile; there are no ids to guess.
export const studentRouter = Router();
studentRouter.use(requireUser);

// A suspended account can still log in and fix its name in the profile, but nothing else.
studentRouter.use(async (_req, res, next) => {
  const user = await getUser(res.locals.userId as string);
  if (user?.suspended) {
    res.status(403).json({ error: { message: "Your account is suspended until your name matches your transcript. Fix it in your profile." } });
    return;
  }
  next();
});

studentRouter.post("/", async (req, res) => {
  const body = CreateBody.parse(req.body);
  const student = await createStudent(res.locals.userId as string, body.program, body.designations);
  if (!student) {
    res.status(409).json({ error: { message: "you already have a profile" } });
    return;
  }
  res.status(201).json({ student });
});

studentRouter.get("/", async (_req, res) => {
  const id = await ownStudentId(res);
  if (id) res.json({ student: await getStudent(id) });
});

studentRouter.patch("/", async (req, res) => {
  const { designations } = UpdateBody.parse(req.body);
  const id = await ownStudentId(res);
  if (id) res.json({ student: await updateDesignations(id, designations) });
});

studentRouter.post("/attempts", async (req, res) => {
  const attempt = AttemptBody.parse(req.body);
  const missing = missingCreditHours([attempt]);
  if (missing) {
    res.status(400).json({ error: { message: missing } });
    return;
  }
  const id = await ownStudentId(res);
  if (id) res.status(201).json({ attempt: await addAttempt(id, attempt) });
});

// transcript import: replaces every attempt
studentRouter.put("/attempts", async (req, res) => {
  const { attempts } = ReplaceBody.parse(req.body);
  const missing = missingCreditHours(attempts);
  if (missing) {
    res.status(400).json({ error: { message: missing } });
    return;
  }
  const id = await ownStudentId(res);
  if (id) res.json({ student: await replaceAttempts(id, attempts) });
});

// The raw PDF of the latest imported transcript; replaces any earlier one. Its student number
// has to match the account's and its name the UNB email's, and that is what verifies the
// account. Verifying removes other unverified accounts that typed the same number.
studentRouter.put("/transcript", express.raw({ type: "application/pdf", limit: "5mb" }), async (req, res) => {
  const file: unknown = req.body;
  if (!Buffer.isBuffer(file) || file.subarray(0, 5).toString("latin1") !== "%PDF-") {
    res.status(400).json({ error: { message: "expected a PDF file (content-type application/pdf)" } });
    return;
  }
  const id = await ownStudentId(res);
  if (!id) return;

  const transcript = await readTranscript(file).catch(() => null);
  if (!transcript?.student) {
    res.status(400).json({ error: { message: "Couldn't find a student number in this PDF. Upload the unofficial transcript from myUNB." } });
    return;
  }
  const userId = res.locals.userId as string;
  const user = (await getUser(userId))!;
  if (transcript.student.number !== user.studentNumber) {
    res.status(400).json({ error: { message: "This transcript belongs to a different student number than your account." } });
    return;
  }
  const printed = transcript.student.name;
  if (!emailMatches(user.email, printed)) {
    res.status(400).json({ error: { message: `The name on this transcript, ${fullName(printed)}, doesn't match your UNB email.` } });
    return;
  }
  const removed = await verifyUser(userId, printed, nameMatches(user.name, printed));
  if (!removed) {
    res.status(409).json({ error: { message: "Another account already verified this student number. Contact us and we'll sort it out." } });
    return;
  }
  await saveTranscript(id, file);

  for (const email of removed) {
    await sendEmail(
      email,
      "Your GradTrellis account was removed",
      `Another account verified student number ${user.studentNumber} with its UNB transcript, so your unverified account with the same number was removed.\n\nIf you typed the wrong number, sign up again at ${appUrl}/signup. If that number is yours, reply to this email and we'll sort it out.`,
    );
  }
  const verified = (await getUser(userId))!;
  if (verified.nameDeadline && !user.nameDeadline) {
    await sendEmail(
      user.email,
      "Your name doesn't match your transcript",
      `You signed up to GradTrellis as ${user.name}, but your transcript says ${verified.transcriptName}. Change your name at ${appUrl}/profile by ${verified.nameDeadline.toDateString()}, or your account will be suspended.`,
    );
  }
  res.json({ user: verified });
});

studentRouter.patch("/attempts/:attemptId", async (req, res) => {
  const { result } = ResultBody.parse(req.body);
  const id = await ownStudentId(res);
  if (!id) return;
  const attempt = await updateAttemptResult(id, req.params.attemptId, result);
  if (!attempt) {
    res.status(404).json({ error: { message: "attempt not found" } });
    return;
  }
  res.json({ attempt });
});

studentRouter.delete("/attempts/:attemptId", async (req, res) => {
  const id = await ownStudentId(res);
  if (!id) return;
  if (!(await deleteAttempt(id, req.params.attemptId))) {
    res.status(404).json({ error: { message: "attempt not found" } });
    return;
  }
  res.status(204).end();
});

studentRouter.get("/audit", async (_req, res) => {
  const id = await ownStudentId(res);
  if (!id) return;
  const student = (await getStudent(id))!;
  const audit = runAudit(StudentRecord.parse(student), {
    programs,
    index: courseIndex,
    scale: gradingScale,
    asOf: termOn(new Date()),
  });
  res.json({ audit });
});

// Can the student take these courses in a term? Checked against the calendar's prerequisite
// text; parts it can't read come back as "review" for a person to decide.
studentRouter.get("/eligibility", async (req, res) => {
  const query = EligibilityQuery.parse(req.query);
  const unknown = query.courses.filter((code) => !courseIndex.has(code));
  if (unknown.length) {
    res.status(400).json({ error: { message: `${unknown.join(", ")} ${unknown.length === 1 ? "isn't" : "aren't"} in the current calendar` } });
    return;
  }
  const id = await ownStudentId(res);
  if (!id) return;
  const { attempts } = StudentRecord.parse(await getStudent(id));
  const term = query.term ?? nextTerm(termOn(new Date()));

  const courses = query.courses.map((code) => {
    const course = courseIndex.get(code)!;
    const requisite = course.prereqText ? parseRequisite(course.prereqText) : null;
    return {
      code,
      title: course.title,
      prereqText: course.prereqText,
      coreqText: course.coreqText,
      requisite,
      status: requisite ? checkRequisite(requisite, { attempts, term, index: courseIndex, scale: gradingScale }) : "met",
    };
  });
  res.json({ term, courses });
});

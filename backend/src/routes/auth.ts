import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { checkPassword, endSession, hashPassword, hashToken, newToken, requireUser, SESSION_DAYS, setSessionCookie } from "../auth.ts";
import { sendEmail } from "../email.ts";
import { getStudentForUser } from "../queries/students.ts";
import { confirmSignup, createSession, findUserByEmail, getUser, saveSignup, studentNumberVerified } from "../queries/users.ts";

// where the links in emails point (the frontend)
const appUrl = process.env.APP_URL ?? "http://localhost:5173";

const Email = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._%+-]+@unb\.ca$/, "use your @unb.ca email");

const SignupBody = z.object({
  email: Email,
  studentNumber: z.string().trim().regex(/^\d{7}$/, "student numbers are 7 digits"),
  password: z.string().min(8, "use at least 8 characters").max(128),
});

const LoginBody = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

const ConfirmBody = z.object({ token: z.string().min(1) });

// Slows down password guessing. In memory, so it resets on restart; fine for one server.
const MAX_FAILURES = 10;
const failures = new Map<string, { count: number; until: number }>();

function tooManyFailures(email: string): boolean {
  const f = failures.get(email);
  if (f && f.until < Date.now()) failures.delete(email);
  return (failures.get(email)?.count ?? 0) >= MAX_FAILURES;
}

function recordFailure(email: string) {
  const f = failures.get(email) ?? { count: 0, until: Date.now() + 15 * 60 * 1000 };
  failures.set(email, { ...f, count: f.count + 1 });
}

// compared against when the email is unknown, so both cases take the same time
const DUMMY_HASH = await hashPassword("not a real password");

async function startSession(req: Request, res: Response, userId: string) {
  const { token, hash } = newToken();
  await createSession(hash, userId, SESSION_DAYS);
  setSessionCookie(req, res, token);
}

export const authRouter = Router();

// Always answers the same way, so the form can't be used to find out who has an account.
// The email says what happened.
authRouter.post("/signup", async (req, res) => {
  const { email, studentNumber, password } = SignupBody.parse(req.body);

  if (await findUserByEmail(email)) {
    await sendEmail(email, "You already have a GradTrellis account", `Log in at ${appUrl}/login with this email.`);
  } else if (await studentNumberVerified(studentNumber)) {
    await sendEmail(
      email,
      "That student number is already registered",
      `Someone already signed up to GradTrellis with student number ${studentNumber}. If that wasn't you, reply to this email and we'll sort it out.`,
    );
  } else {
    const { token, hash } = newToken();
    await saveSignup(hash, email, studentNumber, await hashPassword(password));
    await sendEmail(
      email,
      "Confirm your GradTrellis account",
      `Open this link and press Confirm to finish creating your account:\n${appUrl}/confirm?token=${token}\n\nThe link works for 24 hours.`,
    );
  }
  res.status(202).json({ message: "Check your UNB inbox for a confirmation email." });
});

// The emailed link opens a page with a Confirm button that calls this. Confirming on the
// button press, not on opening the link, stops email link scanners from using up the token.
authRouter.post("/confirm", async (req, res) => {
  const { token } = ConfirmBody.parse(req.body);
  const userId = await confirmSignup(hashToken(token));
  if (!userId) {
    res.status(400).json({ error: { message: "This link has expired or was already used. Sign up again to get a new one." } });
    return;
  }
  await startSession(req, res, userId);
  res.status(201).json({ user: await getUser(userId) });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = LoginBody.parse(req.body);
  if (tooManyFailures(email)) {
    res.status(429).json({ error: { message: "Too many attempts. Try again in 15 minutes." } });
    return;
  }
  const user = await findUserByEmail(email);
  const ok = await checkPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    recordFailure(email);
    res.status(401).json({ error: { message: "Wrong email or password." } });
    return;
  }
  failures.delete(email);
  await startSession(req, res, user.id);
  res.json({ user: await getUser(user.id) });
});

authRouter.post("/logout", async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

// the logged-in user and their degree profile (null until they set one up)
authRouter.get("/me", requireUser, async (_req, res) => {
  const userId = res.locals.userId as string;
  res.json({ user: await getUser(userId), student: await getStudentForUser(userId) });
});

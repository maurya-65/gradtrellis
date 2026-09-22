import { existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sampleTranscript } from "./transcript-pdf.ts";

const envFile = join(import.meta.dirname, "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const databaseUrl = process.env.TEST_DATABASE_URL;

// No mail provider in tests: collect what would have been sent.
const sent = vi.hoisted(() => [] as Array<{ to: string; subject: string; text: string }>);
vi.mock("../src/email.ts", () => ({
  appUrl: "http://localhost:5173",
  sendEmail: async (to: string, subject: string, text: string) => {
    sent.push({ to, subject, text });
  },
}));

// Runs against a real database. The tables in TEST_DATABASE_URL are dropped and recreated.
describe.skipIf(!databaseUrl)("API", () => {
  let base = "";
  let db: pg.Pool;
  let close = async () => {};

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const { pool } = await import("../src/db.ts");
    db = pool;
    const { migrate } = await import("../src/migrate.ts");
    const { app } = await import("../src/app.ts");

    await pool.query("DROP TABLE IF EXISTS password_resets, transcripts, attempts, students, sessions, signups, users, schema_migrations");
    await migrate();

    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
    close = async () => {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    };
  });

  afterAll(() => close());

  // responses are loosely typed here; the assertions check their shape
  async function call(method: string, path: string, body?: unknown, cookie?: string): Promise<{ status: number; body: any; cookie?: string }> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;
    const res = await fetch(base + path, { method, headers, body: typeof body === "string" ? body : JSON.stringify(body) });
    const setCookie = res.headers.get("set-cookie")?.split(";")[0];
    return { status: res.status, body: res.status === 204 ? null : await res.json(), ...(setCookie && { cookie: setCookie }) };
  }

  let counter = 0;
  function newIdentity() {
    counter++;
    // an email without a dot can't be read for a name, so any transcript name passes it
    return { name: "Test Student", email: `student${counter}@unb.ca`, studentNumber: String(3000000 + counter), password: "correct horse battery" };
  }

  function linkTokenFor(email: string): string | undefined {
    const mail = sent.findLast((m) => m.to === email);
    return mail?.text.match(/\?token=([\w-]+)/)?.[1];
  }

  // signs up, confirms, and returns the session cookie
  async function newUser(identity = newIdentity()): Promise<string> {
    expect((await call("POST", "/auth/signup", identity)).status).toBe(202);
    const confirmed = await call("POST", "/auth/confirm", { token: linkTokenFor(identity.email) });
    expect(confirmed.status).toBe(201);
    return confirmed.cookie!;
  }

  async function newStudent(designations: string[] = [], identity = newIdentity()) {
    const cookie = await newUser(identity);
    const res = await call("POST", "/student", { program: { entry: { season: "Fall", year: 2024 } }, designations }, cookie);
    expect(res.status).toBe(201);
    return { cookie, identity, student: res.body.student };
  }

  async function upload(cookie: string, file: Buffer): Promise<{ status: number; body: any }> {
    const res = await fetch(`${base}/student/transcript`, {
      method: "PUT",
      headers: { "content-type": "application/pdf", cookie },
      body: new Uint8Array(file),
    });
    return { status: res.status, body: await res.json() };
  }

  const cs1073 = { code: "CS 1073", term: { season: "Fall", year: 2024 }, result: "A" };

  describe("accounts", () => {
    it("creates the account only once the emailed link is confirmed", async () => {
      const identity = newIdentity();
      expect((await call("POST", "/auth/signup", identity)).status).toBe(202);
      expect(sent.at(-1)).toMatchObject({ to: identity.email, subject: "Confirm your GradTrellis account" });

      expect((await call("POST", "/auth/login", identity)).status).toBe(401);

      const confirmed = await call("POST", "/auth/confirm", { token: linkTokenFor(identity.email) });
      expect(confirmed.status).toBe(201);
      expect(confirmed.body.user).toMatchObject({ email: identity.email, name: "Test Student", studentNumber: identity.studentNumber, verified: false });

      const me = await call("GET", "/auth/me", undefined, confirmed.cookie);
      expect(me.body).toMatchObject({ user: { email: identity.email }, student: null });
    });

    it("uses a confirmation link only once", async () => {
      const identity = newIdentity();
      await call("POST", "/auth/signup", identity);
      const token = linkTokenFor(identity.email);
      expect((await call("POST", "/auth/confirm", { token })).status).toBe(201);
      expect((await call("POST", "/auth/confirm", { token })).status).toBe(400);
    });

    it("needs a name, a UNB email, a 7-digit student number and an 8+ character password", async () => {
      const res = await call("POST", "/auth/signup", { name: " ", email: "me@gmail.com", studentNumber: "12345", password: "short" });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(["email", "name", "password", "studentNumber"]);
    });

    it("doesn't reveal an existing email, and never creates a second account for it", async () => {
      const identity = newIdentity();
      await newUser(identity);

      const sameEmail = await call("POST", "/auth/signup", { ...newIdentity(), email: identity.email });
      expect(sameEmail.status).toBe(202);
      expect(sent.at(-1)).toMatchObject({ to: identity.email, subject: "You already have a GradTrellis account" });

      const { rows } = await db.query("SELECT count(*)::int AS n FROM users WHERE email = $1", [identity.email]);
      expect(rows[0].n).toBe(1);
    });

    it("logs in and out", async () => {
      const identity = newIdentity();
      await newUser(identity);
      expect((await call("POST", "/auth/login", { ...identity, password: "wrong password" })).status).toBe(401);

      const login = await call("POST", "/auth/login", { email: identity.email.toUpperCase(), password: identity.password });
      expect(login.status).toBe(200);
      expect((await call("GET", "/auth/me", undefined, login.cookie)).status).toBe(200);

      expect((await call("POST", "/auth/logout", undefined, login.cookie)).status).toBe(204);
      expect((await call("GET", "/auth/me", undefined, login.cookie)).status).toBe(401);
    });

    it("locks login after 10 wrong passwords", async () => {
      const identity = newIdentity();
      await newUser(identity);
      for (let i = 0; i < 10; i++) await call("POST", "/auth/login", { ...identity, password: "wrong password" });
      expect((await call("POST", "/auth/login", identity)).status).toBe(429);
    });
  });

  describe("passwords", () => {
    it("resets a forgotten password once, logging out every other session", async () => {
      const identity = newIdentity();
      const oldSession = await newUser(identity);

      expect((await call("POST", "/auth/forgot-password", { email: identity.email.toUpperCase() })).status).toBe(202);
      expect(sent.at(-1)).toMatchObject({ to: identity.email, subject: "Reset your GradTrellis password" });
      const token = linkTokenFor(identity.email);

      expect((await call("POST", "/auth/reset-password", { token, password: "short" })).status).toBe(400);
      const reset = await call("POST", "/auth/reset-password", { token, password: "a brand new password" });
      expect(reset.status).toBe(200);
      expect(reset.body.user).toMatchObject({ email: identity.email });
      expect((await call("GET", "/auth/me", undefined, reset.cookie)).status).toBe(200);
      expect((await call("GET", "/auth/me", undefined, oldSession)).status).toBe(401);

      expect((await call("POST", "/auth/reset-password", { token, password: "another new password" })).status).toBe(400);
      expect((await call("POST", "/auth/login", identity)).status).toBe(401);
      expect((await call("POST", "/auth/login", { ...identity, password: "a brand new password" })).status).toBe(200);
    });

    it("only the latest reset link works", async () => {
      const identity = newIdentity();
      await newUser(identity);
      await call("POST", "/auth/forgot-password", { email: identity.email });
      const first = linkTokenFor(identity.email);
      await call("POST", "/auth/forgot-password", { email: identity.email });
      expect((await call("POST", "/auth/reset-password", { token: first, password: "a brand new password" })).status).toBe(400);
      expect((await call("POST", "/auth/reset-password", { token: linkTokenFor(identity.email), password: "a brand new password" })).status).toBe(200);
    });

    it("doesn't reveal whether an email has an account", async () => {
      const before = sent.length;
      const res = await call("POST", "/auth/forgot-password", { email: "nobody@unb.ca" });
      expect(res.status).toBe(202);
      expect(sent.length).toBe(before);
    });

    it("changes the password with the current one", async () => {
      const identity = newIdentity();
      const cookie = await newUser(identity);
      const other = (await call("POST", "/auth/login", identity)).cookie;

      expect((await call("PUT", "/auth/password", { currentPassword: "wrong password", newPassword: "a brand new password" }, cookie)).status).toBe(400);
      const changed = await call("PUT", "/auth/password", { currentPassword: identity.password, newPassword: "a brand new password" }, cookie);
      expect(changed.status).toBe(204);

      expect((await call("GET", "/auth/me", undefined, changed.cookie)).status).toBe(200);
      expect((await call("GET", "/auth/me", undefined, other)).status).toBe(401);
      expect((await call("POST", "/auth/login", { ...identity, password: "a brand new password" })).status).toBe(200);
    });
  });

  describe("student number verification", () => {
    it("verifies the account from a transcript with the same student number", async () => {
      const { cookie, identity } = await newStudent();
      const res = await upload(cookie, sampleTranscript(identity.studentNumber));
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ verified: true, name: "Test Student", transcriptName: "Test Student", nameDeadline: null, suspended: false });
      expect((await call("GET", "/auth/me", undefined, cookie)).body.user.verified).toBe(true);
    });

    it("refuses a transcript with a different student number and stores nothing", async () => {
      const { cookie, student } = await newStudent();
      const res = await upload(cookie, sampleTranscript("1111111"));
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("different student number");
      expect((await call("GET", "/auth/me", undefined, cookie)).body.user.verified).toBe(false);
      const { rowCount } = await db.query("SELECT 1 FROM transcripts WHERE student_id = $1", [student.id]);
      expect(rowCount).toBe(0);
    });

    it("refuses a PDF without a student number", async () => {
      const { cookie } = await newStudent();
      const res = await upload(cookie, Buffer.from("%PDF-1.4 not really a transcript"));
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("Couldn't find a student number");
    });

    it("doesn't let someone typing your number lock you out, and removes them when you verify", async () => {
      const yours = newIdentity();
      const squatter = { ...newIdentity(), studentNumber: yours.studentNumber };
      const { cookie: theirCookie } = await newStudent([], squatter);

      // the squatter got there first, but a typed number blocks nobody
      const { cookie } = await newStudent([], yours);
      expect((await upload(cookie, sampleTranscript(yours.studentNumber))).status).toBe(200);

      // verifying deletes the other unverified account with that number, and tells them
      expect((await call("GET", "/auth/me", undefined, theirCookie)).status).toBe(401);
      expect(sent.find((m) => m.to === squatter.email && m.subject === "Your GradTrellis account was removed")).toBeDefined();
      const { rows } = await db.query("SELECT email FROM users WHERE student_number = $1", [yours.studentNumber]);
      expect(rows).toEqual([{ email: yours.email }]);

      // and new signups with a verified number are turned away by email
      const late = newIdentity();
      await call("POST", "/auth/signup", { ...late, studentNumber: yours.studentNumber });
      expect(sent.at(-1)).toMatchObject({ to: late.email, subject: "That student number is already registered" });
      expect(linkTokenFor(late.email)).toBeUndefined();
    });
  });

  describe("names", () => {
    it("refuses a transcript whose name doesn't match the UNB email", async () => {
      const identity = { ...newIdentity(), name: "Anne Tremblay", email: `anne.tremblay${counter}@unb.ca` };
      const { cookie } = await newStudent([], identity);

      const res = await upload(cookie, sampleTranscript(identity.studentNumber, "Smith, John"));
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("John Smith, doesn't match your UNB email");
      expect((await call("GET", "/auth/me", undefined, cookie)).body.user.verified).toBe(false);

      expect((await upload(cookie, sampleTranscript(identity.studentNumber, "Tremblay, Anne Marie"))).status).toBe(200);
    });

    it("gives a signup name that doesn't match the transcript a deadline, lifted by fixing it", async () => {
      const identity = { ...newIdentity(), name: "Someone Else" };
      const { cookie } = await newStudent([], identity);

      const res = await upload(cookie, sampleTranscript(identity.studentNumber));
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ verified: true, name: "Someone Else", transcriptName: "Test Student", suspended: false });
      const days = (new Date(res.body.user.nameDeadline).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(6.9);
      expect(sent.at(-1)).toMatchObject({ to: identity.email, subject: "Your name doesn't match your transcript" });

      const wrong = await call("PATCH", "/auth/me", { name: "Another Name" }, cookie);
      expect(wrong.status).toBe(400);
      expect(wrong.body.error.message).toContain("Test Student");

      const fixed = await call("PATCH", "/auth/me", { name: "  test   student " }, cookie);
      expect(fixed.status).toBe(200);
      expect(fixed.body.user).toMatchObject({ name: "test student", nameDeadline: null });
    });

    it("suspends the account once the deadline passes, until the name is fixed", async () => {
      const identity = { ...newIdentity(), name: "Someone Else" };
      const { cookie } = await newStudent([], identity);
      await upload(cookie, sampleTranscript(identity.studentNumber));
      await db.query("UPDATE users SET name_deadline = now() - interval '1 minute' WHERE email = $1", [identity.email]);

      expect((await call("GET", "/auth/me", undefined, cookie)).body.user.suspended).toBe(true);
      const blocked = await call("GET", "/student/audit", undefined, cookie);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.message).toContain("suspended");

      expect((await call("PATCH", "/auth/me", { name: "Test Student" }, cookie)).status).toBe(200);
      expect((await call("GET", "/student/audit", undefined, cookie)).status).toBe(200);
    });

    it("lets an unverified account change its name freely", async () => {
      const cookie = await newUser();
      const res = await call("PATCH", "/auth/me", { name: "New Name" }, cookie);
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe("New Name");
    });
  });

  describe("student profile", () => {
    it("needs a login", async () => {
      expect((await call("GET", "/student")).status).toBe(401);
      expect((await call("GET", "/student/audit", undefined, "sid=made-up")).status).toBe(401);
    });

    it("creates one profile per account, with UNB BCS defaults", async () => {
      const { cookie, student } = await newStudent(["honours"]);
      expect(student.program).toEqual({ institution: "unb", campus: "fredericton", code: "BCS", entry: { season: "Fall", year: 2024 } });
      expect(student.designations).toEqual(["honours"]);
      expect((await call("GET", "/student", undefined, cookie)).body.student).toEqual(student);

      const again = await call("POST", "/student", { program: { entry: { season: "Fall", year: 2025 } } }, cookie);
      expect(again.status).toBe(409);
    });

    it("asks for a profile before anything else", async () => {
      const cookie = await newUser();
      expect((await call("GET", "/student/audit", undefined, cookie)).status).toBe(404);
    });

    it("changes designations", async () => {
      const { cookie } = await newStudent();
      const res = await call("PATCH", "/student", { designations: ["cybersecurity"] }, cookie);
      expect(res.body.student.designations).toEqual(["cybersecurity"]);
    });

    it("adds attempts, normalizing the course code, and returns them in term order", async () => {
      const { cookie } = await newStudent();
      await call("POST", "/student/attempts", { code: "cs1083", term: { season: "Winter", year: 2025 }, result: "B" }, cookie);
      const first = await call("POST", "/student/attempts", cs1073, cookie);
      expect(first.status).toBe(201);
      expect(first.body.attempt).toMatchObject({ code: "CS 1073", result: "A", notations: [] });

      const { body } = await call("GET", "/student", undefined, cookie);
      expect(body.student.attempts.map((a: { code: string }) => a.code)).toEqual(["CS 1073", "CS 1083"]);
    });

    it("needs credit hours for a course that isn't in the current calendar", async () => {
      const { cookie } = await newStudent();
      const attempt = { code: "ABC 1234", term: { season: "Fall", year: 2024 }, result: "TR" };
      expect((await call("POST", "/student/attempts", attempt, cookie)).status).toBe(400);

      const withHours = await call("POST", "/student/attempts", { ...attempt, creditHours: 3, title: "Transfer" }, cookie);
      expect(withHours.status).toBe(201);
      expect(withHours.body.attempt).toMatchObject({ creditHours: 3, title: "Transfer" });
    });

    it("rejects invalid attempts with details", async () => {
      const { cookie } = await newStudent();
      const res = await call("POST", "/student/attempts", { code: "not a code", term: { season: "Spring", year: 2024 }, result: "Z" }, cookie);
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(["code", "result", "term.season"]);
    });

    it("changes an attempt's result, and only the owner can", async () => {
      const { cookie } = await newStudent();
      const { body } = await call("POST", "/student/attempts", { ...cs1073, result: "IP" }, cookie);
      const path = `/student/attempts/${body.attempt.id}`;

      const stranger = await newStudent();
      expect((await call("PATCH", path, { result: "A" }, stranger.cookie)).status).toBe(404);
      expect((await call("PATCH", path, { result: "Z" }, cookie)).status).toBe(400);

      const res = await call("PATCH", path, { result: "B+" }, cookie);
      expect(res.status).toBe(200);
      expect(res.body.attempt).toMatchObject({ code: "CS 1073", result: "B+" });
    });

    it("deletes an attempt once, and only the owner can", async () => {
      const { cookie } = await newStudent();
      const { body } = await call("POST", "/student/attempts", cs1073, cookie);
      const path = `/student/attempts/${body.attempt.id}`;

      const stranger = await newStudent();
      expect((await call("DELETE", path, undefined, stranger.cookie)).status).toBe(404);
      expect((await call("DELETE", path, undefined, cookie)).status).toBe(204);
      expect((await call("DELETE", path, undefined, cookie)).status).toBe(404);
      expect((await call("DELETE", "/student/attempts/not-a-uuid", undefined, cookie)).status).toBe(404);
    });

    it("replaces every attempt with an imported transcript", async () => {
      const { cookie } = await newStudent();
      await call("POST", "/student/attempts", { code: "CS 1303", term: { season: "Fall", year: 2024 }, result: "B" }, cookie);

      const res = await call(
        "PUT",
        "/student/attempts",
        {
          attempts: [
            cs1073,
            { code: "TME 5386", term: { season: "Winter", year: 2025 }, result: "IP", creditHours: 3, title: "ENTREPRENEURIAL RESILIENCE" },
          ],
        },
        cookie,
      );
      expect(res.status).toBe(200);
      expect(res.body.student.attempts.map((a: { code: string }) => a.code)).toEqual(["CS 1073", "TME 5386"]);
    });

    it("keeps the old attempts when an import is rejected", async () => {
      const { cookie } = await newStudent();
      await call("POST", "/student/attempts", { code: "CS 1303", term: { season: "Fall", year: 2024 }, result: "B" }, cookie);

      const res = await call("PUT", "/student/attempts", { attempts: [{ ...cs1073, code: "ABC 1234" }] }, cookie);
      expect(res.status).toBe(400);
      const { body } = await call("GET", "/student", undefined, cookie);
      expect(body.student.attempts.map((a: { code: string }) => a.code)).toEqual(["CS 1303"]);
    });

    it("keeps only the latest transcript upload", async () => {
      const { cookie, identity, student } = await newStudent();
      const first = sampleTranscript(identity.studentNumber, "Student, First");
      const second = sampleTranscript(identity.studentNumber, "Student, Second");
      expect((await upload(cookie, first)).status).toBe(200);
      expect((await upload(cookie, second)).status).toBe(200);

      const { rows } = await db.query("SELECT file FROM transcripts WHERE student_id = $1", [student.id]);
      expect(rows.map((r) => Buffer.compare(r.file, second))).toEqual([0]);
    });

    it("rejects transcripts that aren't PDFs or are too large", async () => {
      const { cookie } = await newStudent();
      expect((await upload(cookie, Buffer.from("not a pdf"))).status).toBe(400);
      expect((await upload(cookie, Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(6 * 1024 * 1024)]))).status).toBe(413);
    });

    it("checks prerequisites for a term, counting in-progress courses as pending", async () => {
      const { cookie } = await newStudent();
      await call("POST", "/student/attempts", cs1073, cookie);
      await call("POST", "/student/attempts", { code: "CS 1083", term: { season: "Winter", year: 2025 }, result: "IP" }, cookie);

      const res = await call("GET", `/student/eligibility?courses=${encodeURIComponent("cs1083,CS 2043,CS 2999")}&term=Fall%202025`, undefined, cookie);
      expect(res.status).toBe(200);
      expect(res.body.term).toEqual({ season: "Fall", year: 2025 });
      expect(res.body.courses.map((c: { code: string; status: string }) => [c.code, c.status])).toEqual([
        ["CS 1083", "met"],
        ["CS 2043", "pending"],
        ["CS 2999", "review"],
      ]);

      expect((await call("GET", "/student/eligibility?courses=CS%209999", undefined, cookie)).status).toBe(400);
      expect((await call("GET", "/student/eligibility?courses=CS%201083&term=Spring%202025", undefined, cookie)).status).toBe(400);
    });

    it("suggests required courses the student can take next, met prerequisites first", async () => {
      const { cookie } = await newStudent();
      await call("POST", "/student/attempts", cs1073, cookie);

      const res = await call("GET", "/student/suggestions?term=Winter%202025", undefined, cookie);
      expect(res.status).toBe(200);
      const byCode = new Map(res.body.courses.map((c: { code: string; status: string }) => [c.code, c.status]));
      expect(byCode.get("CS 1083")).toBe("met");
      // taken already, or blocked by CS 1083
      expect(byCode.has("CS 1073")).toBe(false);
      expect(byCode.has("CS 2043")).toBe(false);
      const statuses = res.body.courses.map((c: { status: string }) => c.status);
      expect(statuses).toEqual([...statuses].sort((a: string, b: string) => ["met", "pending", "review"].indexOf(a) - ["met", "pending", "review"].indexOf(b)));
    });

    it("audits the student", async () => {
      const { cookie } = await newStudent();
      await call("POST", "/student/attempts", cs1073, cookie);
      const res = await call("GET", "/student/audit", undefined, cookie);
      expect(res.status).toBe(200);
      expect(res.body.audit.status).toBe("incomplete");
      expect(res.body.audit.totals.creditHours.have).toBe(4);
    });
  });

  it("reports health and the course calendar year", async () => {
    const res = await call("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.body.calendarYear).toMatch(/^\d{4}-\d{4}$/);
  });

  it("searches courses by code prefix and title", async () => {
    const byCode = await call("GET", "/courses?q=cs10&limit=3");
    expect(byCode.body.courses.length).toBe(3);
    expect(byCode.body.courses.every((c: { code: string }) => c.code.startsWith("CS 10"))).toBe(true);

    const byTitle = await call("GET", "/courses?q=data structures");
    expect(byTitle.body.courses.map((c: { code: string }) => c.code)).toContain("CS 2383");

    expect((await call("GET", "/courses?limit=500")).status).toBe(400);
  });

  it("returns 404 for unknown routes and rejects malformed JSON", async () => {
    expect((await call("GET", "/nothing")).status).toBe(404);
    const res = await call("POST", "/auth/login", "{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("request body is not valid JSON");
  });
});

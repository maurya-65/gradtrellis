import { existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const envFile = join(import.meta.dirname, "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const databaseUrl = process.env.TEST_DATABASE_URL;

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

    await pool.query("DROP TABLE IF EXISTS transcripts, attempts, students, schema_migrations");
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
  async function call(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  }

  async function newStudent(designations: string[] = []) {
    const res = await call("POST", "/students", { program: { entry: { season: "Fall", year: 2024 } }, designations });
    expect(res.status).toBe(201);
    return res.body.student;
  }

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

  it("creates a student with UNB BCS defaults", async () => {
    const student = await newStudent(["honours"]);
    expect(student.program).toEqual({
      institution: "unb",
      campus: "fredericton",
      code: "BCS",
      entry: { season: "Fall", year: 2024 },
    });
    expect(student.designations).toEqual(["honours"]);
    expect(student.attempts).toEqual([]);

    const fetched = await call("GET", `/students/${student.id}`);
    expect(fetched.body.student).toEqual(student);
  });

  it("changes designations", async () => {
    const student = await newStudent();
    const res = await call("PATCH", `/students/${student.id}`, { designations: ["cybersecurity"] });
    expect(res.status).toBe(200);
    expect(res.body.student.designations).toEqual(["cybersecurity"]);
  });

  it("adds attempts, normalizing the course code, and returns them in term order", async () => {
    const student = await newStudent();
    await call("POST", `/students/${student.id}/attempts`, { code: "cs1083", term: { season: "Winter", year: 2025 }, result: "B" });
    const first = await call("POST", `/students/${student.id}/attempts`, { code: "CS 1073", term: { season: "Fall", year: 2024 }, result: "A" });
    expect(first.status).toBe(201);
    expect(first.body.attempt).toMatchObject({ code: "CS 1073", result: "A", notations: [] });

    const { body } = await call("GET", `/students/${student.id}`);
    expect(body.student.attempts.map((a: { code: string }) => a.code)).toEqual(["CS 1073", "CS 1083"]);
  });

  it("needs credit hours for a course that isn't in the current calendar", async () => {
    const student = await newStudent();
    const attempt = { code: "ABC 1234", term: { season: "Fall", year: 2024 }, result: "TR" };
    expect((await call("POST", `/students/${student.id}/attempts`, attempt)).status).toBe(400);

    const withHours = await call("POST", `/students/${student.id}/attempts`, { ...attempt, creditHours: 3, title: "Transfer" });
    expect(withHours.status).toBe(201);
    expect(withHours.body.attempt).toMatchObject({ creditHours: 3, title: "Transfer" });
  });

  it("rejects invalid attempts with details", async () => {
    const student = await newStudent();
    const res = await call("POST", `/students/${student.id}/attempts`, { code: "not a code", term: { season: "Spring", year: 2024 }, result: "Z" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(["code", "result", "term.season"]);
  });

  it("deletes an attempt once", async () => {
    const student = await newStudent();
    const { body } = await call("POST", `/students/${student.id}/attempts`, { code: "CS 1073", term: { season: "Fall", year: 2024 }, result: "A" });
    expect((await call("DELETE", `/students/${student.id}/attempts/${body.attempt.id}`)).status).toBe(204);
    expect((await call("DELETE", `/students/${student.id}/attempts/${body.attempt.id}`)).status).toBe(404);
  });

  it("replaces every attempt with an imported transcript", async () => {
    const student = await newStudent();
    await call("POST", `/students/${student.id}/attempts`, { code: "CS 1303", term: { season: "Fall", year: 2024 }, result: "B" });

    const res = await call("PUT", `/students/${student.id}/attempts`, {
      attempts: [
        { code: "CS 1073", term: { season: "Fall", year: 2024 }, result: "A" },
        { code: "TME 5386", term: { season: "Winter", year: 2025 }, result: "IP", creditHours: 3, title: "ENTREPRENEURIAL RESILIENCE" },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.student.attempts.map((a: { code: string }) => a.code)).toEqual(["CS 1073", "TME 5386"]);
  });

  it("keeps the old attempts when an import is rejected", async () => {
    const student = await newStudent();
    await call("POST", `/students/${student.id}/attempts`, { code: "CS 1303", term: { season: "Fall", year: 2024 }, result: "B" });

    const res = await call("PUT", `/students/${student.id}/attempts`, {
      attempts: [{ code: "ABC 1234", term: { season: "Fall", year: 2024 }, result: "A" }],
    });
    expect(res.status).toBe(400);
    const { body } = await call("GET", `/students/${student.id}`);
    expect(body.student.attempts.map((a: { code: string }) => a.code)).toEqual(["CS 1303"]);
  });

  async function upload(studentId: string, file: Buffer) {
    const res = await fetch(`${base}/students/${studentId}/transcript`, {
      method: "PUT",
      headers: { "content-type": "application/pdf" },
      body: new Uint8Array(file),
    });
    return res.status;
  }

  it("keeps only the latest transcript upload", async () => {
    const student = await newStudent();
    expect(await upload(student.id, Buffer.from("%PDF-1.4 first"))).toBe(204);
    expect(await upload(student.id, Buffer.from("%PDF-1.4 second"))).toBe(204);

    const { rows } = await db.query("SELECT file FROM transcripts WHERE student_id = $1", [student.id]);
    expect(rows.map((r) => r.file.toString())).toEqual(["%PDF-1.4 second"]);
  });

  it("rejects transcripts that aren't PDFs or are too large", async () => {
    const student = await newStudent();
    expect(await upload(student.id, Buffer.from("not a pdf"))).toBe(400);
    expect(await upload(student.id, Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(6 * 1024 * 1024)]))).toBe(413);
    expect(await upload("00000000-0000-0000-0000-000000000000", Buffer.from("%PDF-1.4"))).toBe(404);
  });

  it("audits a student", async () => {
    const student = await newStudent();
    await call("POST", `/students/${student.id}/attempts`, { code: "CS 1073", term: { season: "Fall", year: 2024 }, result: "A" });
    const res = await call("GET", `/students/${student.id}/audit`);
    expect(res.status).toBe(200);
    expect(res.body.audit.status).toBe("incomplete");
    expect(res.body.audit.totals.creditHours.have).toBe(4);
  });

  it("returns 404 for unknown students and routes", async () => {
    expect((await call("GET", "/students/00000000-0000-0000-0000-000000000000")).status).toBe(404);
    expect((await call("GET", "/students/not-a-uuid/audit")).status).toBe(404);
    expect((await call("POST", "/students/not-a-uuid/attempts", { code: "CS 1073", term: { season: "Fall", year: 2024 }, result: "A" })).status).toBe(404);
    expect((await call("GET", "/nothing")).status).toBe(404);
  });

  it("rejects a malformed JSON body", async () => {
    const res = await call("POST", "/students", "{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("request body is not valid JSON");
  });
});

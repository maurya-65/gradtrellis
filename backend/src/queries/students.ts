import type { Attempt, StudentRecord } from "../engine/index.ts";
import { pool } from "../db.ts";

export type StoredAttempt = Attempt & { id: string };
export type Student = Omit<StudentRecord, "attempts"> & { attempts: StoredAttempt[] };

interface StudentRow {
  id: string;
  institution: string;
  campus: string;
  program_code: string;
  entry_season: "Winter" | "Summer" | "Fall";
  entry_year: number;
  designations: string[];
}

interface AttemptRow {
  id: string;
  course_code: string;
  term_season: "Winter" | "Summer" | "Fall";
  term_year: number;
  result: Attempt["result"];
  notations: Attempt["notations"];
  credit_hours: string | null;
  title: string | null;
}

// Postgres throws on a malformed uuid; treat it as "not found" instead.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ATTEMPT_COLUMNS = "id, course_code, term_season, term_year, result, notations, credit_hours, title";

function toAttempt(row: AttemptRow): StoredAttempt {
  return {
    id: row.id,
    code: row.course_code,
    term: { season: row.term_season, year: row.term_year },
    result: row.result,
    notations: row.notations,
    ...(row.credit_hours !== null && { creditHours: Number(row.credit_hours) }),
    ...(row.title !== null && { title: row.title }),
  };
}

export async function createStudent(program: StudentRecord["program"], designations: string[]): Promise<Student> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO students (institution, campus, program_code, entry_season, entry_year, designations)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [program.institution, program.campus, program.code, program.entry.season, program.entry.year, designations],
  );
  return (await getStudent(rows[0]!.id))!;
}

export async function getStudent(id: string): Promise<Student | null> {
  if (!UUID.test(id)) return null;
  const { rows } = await pool.query<StudentRow>("SELECT * FROM students WHERE id = $1", [id]);
  const s = rows[0];
  if (!s) return null;

  const attempts = await pool.query<AttemptRow>(
    `SELECT ${ATTEMPT_COLUMNS} FROM attempts WHERE student_id = $1
     ORDER BY term_year, array_position(ARRAY['Winter', 'Summer', 'Fall'], term_season), created_at`,
    [id],
  );
  return {
    id: s.id,
    program: {
      institution: s.institution,
      campus: s.campus,
      code: s.program_code,
      entry: { season: s.entry_season, year: s.entry_year },
    },
    designations: s.designations,
    attempts: attempts.rows.map(toAttempt),
  };
}

export async function updateDesignations(id: string, designations: string[]): Promise<Student | null> {
  if (!UUID.test(id)) return null;
  const res = await pool.query("UPDATE students SET designations = $1, updated_at = now() WHERE id = $2", [designations, id]);
  return res.rowCount ? getStudent(id) : null;
}

export async function addAttempt(studentId: string, a: Attempt): Promise<StoredAttempt | null> {
  if (!UUID.test(studentId)) return null;
  const { rows } = await pool.query<AttemptRow>(
    `INSERT INTO attempts (student_id, course_code, term_season, term_year, result, notations, credit_hours, title)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8 WHERE EXISTS (SELECT 1 FROM students WHERE id = $1)
     RETURNING ${ATTEMPT_COLUMNS}`,
    [studentId, a.code, a.term.season, a.term.year, a.result, a.notations, a.creditHours ?? null, a.title ?? null],
  );
  return rows[0] ? toAttempt(rows[0]) : null;
}

// For a transcript import: the new list replaces everything, all or nothing.
export async function replaceAttempts(studentId: string, attempts: Attempt[]): Promise<Student | null> {
  if (!UUID.test(studentId)) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT 1 FROM students WHERE id = $1 FOR UPDATE", [studentId]);
    if (!found.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query("DELETE FROM attempts WHERE student_id = $1", [studentId]);
    for (const a of attempts) {
      await client.query(
        `INSERT INTO attempts (student_id, course_code, term_season, term_year, result, notations, credit_hours, title)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [studentId, a.code, a.term.season, a.term.year, a.result, a.notations, a.creditHours ?? null, a.title ?? null],
      );
    }
    await client.query("UPDATE students SET updated_at = now() WHERE id = $1", [studentId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getStudent(studentId);
}

export async function deleteAttempt(studentId: string, attemptId: string): Promise<boolean> {
  if (!UUID.test(studentId) || !UUID.test(attemptId)) return false;
  const res = await pool.query("DELETE FROM attempts WHERE id = $1 AND student_id = $2", [attemptId, studentId]);
  return (res.rowCount ?? 0) > 0;
}

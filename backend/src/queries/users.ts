import { pool } from "../db.ts";
import { fullName } from "../names.ts";

export interface User {
  id: string;
  email: string;
  studentNumber: string;
  // as typed at signup, or changed later
  name: string;
  // set once a transcript with the same student number is uploaded
  verified: boolean;
  // the name on that transcript, first names first
  transcriptName: string | null;
  // when the name doesn't match the transcript: the date it has to be fixed by
  nameDeadline: Date | null;
  // the deadline passed without a fix
  suspended: boolean;
}

interface UserRow {
  id: string;
  email: string;
  student_number: string;
  password_hash: string;
  name: string;
  transcript_name: string | null;
  verified_at: Date | null;
  name_deadline: Date | null;
}

function toUser(u: UserRow): User {
  return {
    id: u.id,
    email: u.email,
    studentNumber: u.student_number,
    name: u.name,
    verified: u.verified_at !== null,
    transcriptName: u.transcript_name && fullName(u.transcript_name),
    nameDeadline: u.name_deadline,
    suspended: u.name_deadline !== null && u.name_deadline < new Date(),
  };
}

export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
  const u = rows[0];
  return u ? { ...toUser(u), passwordHash: u.password_hash } : null;
}

export async function getUser(id: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

// Only a verified number blocks a signup; a typed one proves nothing.
export async function studentNumberVerified(studentNumber: string): Promise<boolean> {
  const { rowCount } = await pool.query("SELECT 1 FROM users WHERE student_number = $1 AND verified_at IS NOT NULL", [studentNumber]);
  return (rowCount ?? 0) > 0;
}

// as printed on the verified transcript ("Lastname, Firstnames")
export async function getTranscriptName(id: string): Promise<string | null> {
  const { rows } = await pool.query<{ transcript_name: string | null }>("SELECT transcript_name FROM users WHERE id = $1", [id]);
  return rows[0]?.transcript_name ?? null;
}

// After a transcript with the user's student number was uploaded. A name that doesn't match
// the transcript gets 7 days to be fixed. Other accounts that only typed the same number are
// deleted, and their emails returned so they can be told. Null if another account already
// verified that number.
export async function verifyUser(id: string, transcriptName: string, nameMatches: boolean): Promise<string[] | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ student_number: string }>(
      `UPDATE users SET verified_at = coalesce(verified_at, now()), transcript_name = $2,
         name_deadline = CASE WHEN $3::boolean THEN NULL ELSE coalesce(name_deadline, now() + interval '7 days') END
       WHERE id = $1 RETURNING student_number`,
      [id, transcriptName, nameMatches],
    );
    const removed = await client.query<{ email: string }>("DELETE FROM users WHERE student_number = $1 AND verified_at IS NULL RETURNING email", [
      rows[0]!.student_number,
    ]);
    await client.query("COMMIT");
    return removed.rows.map((r) => r.email);
  } catch (err) {
    await client.query("ROLLBACK");
    if ((err as { code?: string }).code === "23505") return null;
    throw err;
  } finally {
    client.release();
  }
}

// A verified user's new name has already been checked against the transcript, which ends any deadline.
export async function setName(id: string, name: string) {
  await pool.query("UPDATE users SET name = $2, name_deadline = NULL WHERE id = $1", [id, name]);
}

// A new signup for the same email replaces the old one, so only the latest link works.
export async function saveSignup(tokenHash: string, email: string, name: string, studentNumber: string, passwordHash: string) {
  await pool.query(
    `INSERT INTO signups (token_hash, email, name, student_number, password_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + interval '24 hours')
     ON CONFLICT (email) DO UPDATE SET token_hash = excluded.token_hash, name = excluded.name, student_number = excluded.student_number,
       password_hash = excluded.password_hash, expires_at = excluded.expires_at`,
    [tokenHash, email, name, studentNumber, passwordHash],
  );
}

// Turns a confirmed signup into a user. Null if the link is unknown, expired or already used,
// or if the email or student number was registered in the meantime.
export async function confirmSignup(tokenHash: string): Promise<string | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ email: string; name: string; student_number: string; password_hash: string }>(
      "DELETE FROM signups WHERE token_hash = $1 AND expires_at > now() RETURNING email, name, student_number, password_hash",
      [tokenHash],
    );
    const signup = rows[0];
    const created = signup
      ? await client.query<{ id: string }>(
          `INSERT INTO users (email, name, student_number, password_hash) VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING RETURNING id`,
          [signup.email, signup.name, signup.student_number, signup.password_hash],
        )
      : null;
    await client.query("COMMIT");
    return created?.rows[0]?.id ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function savePasswordReset(tokenHash: string, userId: string) {
  await pool.query(
    `INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (user_id) DO UPDATE SET token_hash = excluded.token_hash, expires_at = excluded.expires_at`,
    [tokenHash, userId],
  );
}

// Uses up the link and sets the new password. Null if the link is unknown, expired or already used.
export async function resetPassword(tokenHash: string, passwordHash: string): Promise<string | null> {
  const { rows } = await pool.query<{ user_id: string }>(
    `WITH reset AS (DELETE FROM password_resets WHERE token_hash = $1 AND expires_at > now() RETURNING user_id)
     UPDATE users SET password_hash = $2 FROM reset WHERE users.id = reset.user_id RETURNING users.id AS user_id`,
    [tokenHash, passwordHash],
  );
  return rows[0]?.user_id ?? null;
}

export async function getPasswordHash(userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [userId]);
  return rows[0]?.password_hash ?? null;
}

export async function setPassword(userId: string, passwordHash: string) {
  await pool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, passwordHash]);
}

// logs the user out everywhere (after a password change or reset)
export async function deleteUserSessions(userId: string) {
  await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

export async function createSession(tokenHash: string, userId: string, days: number) {
  await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))", [
    tokenHash,
    userId,
    days,
  ]);
}

export async function findSessionUser(tokenHash: string): Promise<string | null> {
  const { rows } = await pool.query<{ user_id: string }>("SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()", [
    tokenHash,
  ]);
  return rows[0]?.user_id ?? null;
}

export async function deleteSession(tokenHash: string) {
  await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
}

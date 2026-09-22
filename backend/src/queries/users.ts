import { pool } from "../db.ts";

export interface User {
  id: string;
  email: string;
  studentNumber: string;
  // set once a transcript with the same student number is uploaded
  verified: boolean;
  name: string | null;
}

interface UserRow {
  id: string;
  email: string;
  student_number: string;
  password_hash: string;
  name: string | null;
  verified_at: Date | null;
}

function toUser(u: UserRow): User {
  return { id: u.id, email: u.email, studentNumber: u.student_number, verified: u.verified_at !== null, name: u.name };
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

// After a transcript with the user's student number was uploaded. False if another
// account already verified that number.
export async function verifyUser(id: string, name: string): Promise<boolean> {
  try {
    await pool.query("UPDATE users SET verified_at = coalesce(verified_at, now()), name = $2 WHERE id = $1", [id, name]);
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return false;
    throw err;
  }
}

// A new signup for the same email replaces the old one, so only the latest link works.
export async function saveSignup(tokenHash: string, email: string, studentNumber: string, passwordHash: string) {
  await pool.query(
    `INSERT INTO signups (token_hash, email, student_number, password_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + interval '24 hours')
     ON CONFLICT (email) DO UPDATE SET token_hash = excluded.token_hash, student_number = excluded.student_number,
       password_hash = excluded.password_hash, expires_at = excluded.expires_at`,
    [tokenHash, email, studentNumber, passwordHash],
  );
}

// Turns a confirmed signup into a user. Null if the link is unknown, expired or already used,
// or if the email or student number was registered in the meantime.
export async function confirmSignup(tokenHash: string): Promise<string | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ email: string; student_number: string; password_hash: string }>(
      "DELETE FROM signups WHERE token_hash = $1 AND expires_at > now() RETURNING email, student_number, password_hash",
      [tokenHash],
    );
    const signup = rows[0];
    const created = signup
      ? await client.query<{ id: string }>(
          `INSERT INTO users (email, student_number, password_hash) VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING RETURNING id`,
          [signup.email, signup.student_number, signup.password_hash],
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

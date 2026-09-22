import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, RequestHandler, Response } from "express";
import { deleteSession, findSessionUser } from "./queries/users.ts";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const SESSION_COOKIE = "sid";
export const SESSION_DAYS = 30;

// stored as "salt:hash", both hex
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = await scryptAsync(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}

// Tokens go to the user (cookie, email link); the database only keeps their hash.
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // true over HTTPS, false on http://localhost (behind a proxy this needs app.set("trust proxy"))
    secure: req.secure,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export async function endSession(req: Request, res: Response) {
  const token = sessionToken(req);
  if (token) await deleteSession(hashToken(token));
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

function sessionToken(req: Request): string | undefined {
  const pair = req.headers.cookie?.split(";").find((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
  return pair?.trim().slice(SESSION_COOKIE.length + 1) || undefined;
}

// Puts the logged-in user's id in res.locals.userId, or answers 401.
export const requireUser: RequestHandler = async (req, res, next) => {
  const token = sessionToken(req);
  const userId = token ? await findSessionUser(hashToken(token)) : null;
  if (!userId) {
    res.status(401).json({ error: { message: "log in first" } });
    return;
  }
  res.locals.userId = userId;
  next();
};

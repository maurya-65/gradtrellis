import type { Attempt, AuditResult, StudentRecord } from "backend/engine";

// Response types come straight from the engine so client and server stay in sync.
export type Season = Attempt["term"]["season"];
export type Result = Attempt["result"];
export type StoredAttempt = Attempt & { id: string };
export type Student = Omit<StudentRecord, "attempts"> & { attempts: StoredAttempt[] };
export type { AuditResult };

export interface User {
  id: string;
  email: string;
  studentNumber: string;
  // true once a transcript with the same student number was uploaded
  verified: boolean;
  name: string | null;
}

export interface CourseSummary {
  code: string;
  title: string;
  creditHours: number;
  flags: { programming: boolean; writing: boolean; experiential: boolean };
}

export class ApiError extends Error {
  readonly status: number;
  readonly details: Array<{ path: string; message: string }>;

  constructor(status: number, message: string, details: Array<{ path: string; message: string }> = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// a File is sent as-is (transcript upload), anything else as JSON
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isFile = body instanceof File;
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": isFile ? "application/pdf" : "application/json" },
    body: body === undefined ? undefined : isFile ? body : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.message ?? `request failed (${res.status})`, json?.error?.details);
  return json as T;
}

export const api = {
  signup: (input: { email: string; studentNumber: string; password: string }) => request<{ message: string }>("POST", "/auth/signup", input),

  confirm: (token: string) => request<{ user: User }>("POST", "/auth/confirm", { token }).then((r) => r.user),

  login: (email: string, password: string) => request<{ user: User }>("POST", "/auth/login", { email, password }).then((r) => r.user),

  logout: () => request<void>("POST", "/auth/logout"),

  me: () => request<{ user: User; student: Student | null }>("GET", "/auth/me"),

  searchCourses: (q: string, limit = 12) =>
    request<{ courses: CourseSummary[] }>("GET", `/courses?q=${encodeURIComponent(q)}&limit=${limit}`).then((r) => r.courses),

  // the logged-in user's own profile; the session decides whose it is
  createStudent: (input: { program: { entry: { season: Season; year: number } }; designations: string[] }) =>
    request<{ student: Student }>("POST", "/student", input).then((r) => r.student),

  updateDesignations: (designations: string[]) => request<{ student: Student }>("PATCH", "/student", { designations }).then((r) => r.student),

  addAttempt: (attempt: Omit<StoredAttempt, "id" | "notations"> & { notations?: Attempt["notations"] }) =>
    request<{ attempt: StoredAttempt }>("POST", "/student/attempts", attempt).then((r) => r.attempt),

  replaceAttempts: (attempts: Array<Omit<StoredAttempt, "id" | "notations">>) =>
    request<{ student: Student }>("PUT", "/student/attempts", { attempts }).then((r) => r.student),

  // also verifies the account's student number against the one on the transcript
  uploadTranscript: (file: File) => request<{ user: User }>("PUT", "/student/transcript", file).then((r) => r.user),

  updateAttemptResult: (attemptId: string, result: Result) =>
    request<{ attempt: StoredAttempt }>("PATCH", `/student/attempts/${attemptId}`, { result }).then((r) => r.attempt),

  deleteAttempt: (attemptId: string) => request<void>("DELETE", `/student/attempts/${attemptId}`),

  getAudit: () => request<{ audit: AuditResult }>("GET", "/student/audit").then((r) => r.audit),
};

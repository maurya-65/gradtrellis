import type { Attempt, AuditResult, StudentRecord } from "backend/engine";

// Response types come straight from the engine so client and server stay in sync.
export type Season = Attempt["term"]["season"];
export type Result = Attempt["result"];
export type StoredAttempt = Attempt & { id: string };
export type Student = Omit<StudentRecord, "attempts"> & { attempts: StoredAttempt[] };
export type { AuditResult };

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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.message ?? `request failed (${res.status})`, json?.error?.details);
  return json as T;
}

export const api = {
  searchCourses: (q: string, limit = 12) =>
    request<{ courses: CourseSummary[] }>("GET", `/courses?q=${encodeURIComponent(q)}&limit=${limit}`).then((r) => r.courses),

  createStudent: (input: { program: { entry: { season: Season; year: number } }; designations: string[] }) =>
    request<{ student: Student }>("POST", "/students", input).then((r) => r.student),

  getStudent: (id: string) => request<{ student: Student }>("GET", `/students/${id}`).then((r) => r.student),

  updateDesignations: (id: string, designations: string[]) =>
    request<{ student: Student }>("PATCH", `/students/${id}`, { designations }).then((r) => r.student),

  addAttempt: (id: string, attempt: Omit<StoredAttempt, "id" | "notations"> & { notations?: Attempt["notations"] }) =>
    request<{ attempt: StoredAttempt }>("POST", `/students/${id}/attempts`, attempt).then((r) => r.attempt),

  deleteAttempt: (id: string, attemptId: string) => request<void>("DELETE", `/students/${id}/attempts/${attemptId}`),

  getAudit: (id: string) => request<{ audit: AuditResult }>("GET", `/students/${id}/audit`).then((r) => r.audit),
};

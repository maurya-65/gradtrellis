// Calendar data from data/, loaded once at startup.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CourseSnapshot, GradingScale, Program, type CourseIndex } from "./engine/index.ts";

export const dataDir = join(import.meta.dirname, "..", "data");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function jsonFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => join(dir, f));
}

// the newest listings; course facts always come from the current calendar
const courseFiles = jsonFiles(join(dataDir, "courses", "unb-fredericton"));
export const snapshot = CourseSnapshot.parse(readJson(courseFiles.at(-1)!));
export const courseIndex: CourseIndex = new Map(snapshot.courses.map((c) => [c.code, c]));

// every encoded calendar year; the audit picks one by entry term
export const programs: Program[] = readdirSync(join(dataDir, "programs")).flatMap((group) =>
  jsonFiles(join(dataDir, "programs", group)).map((path) => {
    const result = Program.safeParse(readJson(path));
    if (!result.success) throw new Error(`invalid program file ${path}:\n${result.error.message}`);
    return result.data;
  }),
);

export const gradingScale = GradingScale.parse(readJson(join(dataDir, "grading", "unb.json")));

const searchable = snapshot.courses.map((course) => ({
  course,
  code: course.code.replace(" ", "").toLowerCase(),
  title: course.title.toLowerCase(),
}));

// code prefix matches first, then title words
export function searchCourses(query: string, limit: number) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const compact = q.replace(/\s+/g, "");
  const words = q.split(/\s+/);

  const byCode = searchable.filter((s) => s.code.startsWith(compact));
  const byTitle = searchable.filter((s) => !s.code.startsWith(compact) && words.every((w) => s.title.includes(w)));
  return [...byCode, ...byTitle].slice(0, limit).map(({ course }) => ({
    code: course.code,
    title: course.title,
    creditHours: course.creditHours,
    flags: course.flags,
  }));
}

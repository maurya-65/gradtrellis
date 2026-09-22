import { courseIndex, gradingScale, programs } from "../../src/catalog.ts";
import { StudentRecord, type Attempt, type Result, type StudentRecordInput } from "../../src/engine/index.ts";
import type { Season } from "../../src/engine/terms.ts";

export const index = courseIndex;
export const scale = gradingScale;
export const program = programs.find((p) => p.id === "unb-fredericton-bcs-2024-2025")!;

export const T = (season: Season, year: number) => ({ season, year });
export const F24 = T("Fall", 2024);
export const W25 = T("Winter", 2025);
export const S25 = T("Summer", 2025);
export const F25 = T("Fall", 2025);
export const W26 = T("Winter", 2026);
export const F26 = T("Fall", 2026);

export function att(code: string, term: { season: Season; year: number }, result: Result, extra: Partial<Attempt> = {}): StudentRecordInput["attempts"][number] {
  return { code, term, result, ...extra };
}

export function record(attempts: StudentRecordInput["attempts"], extra: Partial<StudentRecordInput> = {}): StudentRecord {
  return StudentRecord.parse({
    id: "test",
    program: { institution: "unb", campus: "fredericton", code: "BCS", entry: F24 },
    attempts,
    ...extra,
  });
}

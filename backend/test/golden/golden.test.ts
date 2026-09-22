import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { courseIndex as index, gradingScale as scale, programs } from "../../src/catalog.ts";
import {
  CourseCode,
  Term,
  cumulativeGpa,
  policyWarnings,
  programForEntry,
  runAudit,
  StudentRecord,
  type AuditResult,
  type RequirementResult,
} from "../../src/engine/index.ts";

const REQ_STATUS = z.enum(["complete", "in-progress", "incomplete", "review"]);
const Count = z.object({ have: z.number(), inProgress: z.number() });

const AuditExpectation = z.object({
  status: REQ_STATUS,
  totals: z.object({ courses: Count, creditHours: Count, working: z.string().optional() }),
  // keyed by requirement id, anywhere in the tree
  requirements: z.record(
    z.string(),
    z.object({
      status: REQ_STATUS,
      used: z.array(CourseCode).optional(),
      includes: z.array(CourseCode).optional(),
      chosenOption: z.string().optional(),
    }),
  ),
  designations: z.record(z.string(), z.object({ status: REQ_STATUS, tier: z.string().optional() })).optional(),
  notCounted: z.array(CourseCode),
  notes: z.string().optional(),
});

const GoldenCase = z.object({
  id: z.string(),
  description: z.string(),
  provenance: z.enum(["synthetic", "anonymized-real"]),
  reviewedBy: z.array(z.string()),
  // the term the expected values were worked out in
  asOf: Term,
  record: StudentRecord,
  expect: z.object({
    cgpa: z.string(),
    cgpaWorking: z.string(),
    warnings: z.array(z.string()),
    warningNotes: z.string().optional(),
    audit: AuditExpectation,
  }),
});

function findResult(audit: AuditResult, id: string): RequirementResult | undefined {
  const walk = (rs: RequirementResult[]): RequirementResult | undefined => {
    for (const r of rs) {
      if (r.id === id) return r;
      const inner = walk(r.children ?? []);
      if (inner) return inner;
    }
    return undefined;
  };
  return walk([...audit.requirements, ...audit.overlays, ...audit.designations.flatMap((d) => d.requirements)]);
}

const codesOf = (r: RequirementResult) => [...r.used, ...(r.surplus ?? [])].map((u) => u.code).sort();

const dir = join(import.meta.dirname, "fixtures");
const cases = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => ({ file: f, data: GoldenCase.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))) }));

describe("golden student histories", () => {
  it("found fixtures", () => {
    expect(cases.length).toBeGreaterThanOrEqual(4);
  });

  for (const { file, data } of cases) {
    describe(`${file}: ${data.description}`, () => {
      const { record } = data;
      const { program, exact } = programForEntry(programs, record.program);

      it("uses the student's entry-year calendar", () => {
        expect(exact).toBe(true);
      });

      it("every course code is known, or carries its own credit hours", () => {
        for (const a of record.attempts) {
          if (!index.has(a.code)) expect(a.creditHours, `${a.code} is unlisted and needs creditHours`).toBeDefined();
        }
      });

      it(`CGPA is ${data.expect.cgpa} (${data.expect.cgpaWorking})`, () => {
        expect(cumulativeGpa(record, index, scale).display).toBe(data.expect.cgpa);
      });

      it(`policy warnings: [${data.expect.warnings.join(", ")}]`, () => {
        const got = [...new Set(policyWarnings(record, program, index, scale).map((w) => w.code))].sort();
        expect(got).toEqual([...data.expect.warnings].sort());
      });

      const audit = data.expect.audit;
      describe("degree audit", () => {
        const result = runAudit(record, { programs, index, scale, asOf: data.asOf });

        it(`overall status is ${audit.status}`, () => {
          expect(result.status).toBe(audit.status);
        });

        it("totals", () => {
          expect({ have: result.totals.courses.have, inProgress: result.totals.courses.inProgress }).toEqual(audit.totals.courses);
          expect({ have: result.totals.creditHours.have, inProgress: result.totals.creditHours.inProgress }).toEqual(audit.totals.creditHours);
        });

        for (const [id, e] of Object.entries(audit.requirements)) {
          it(`${id}: ${e.status}`, () => {
            const r = findResult(result, id);
            expect(r, `requirement ${id} not in audit`).toBeDefined();
            expect(r!.status, r!.remaining).toBe(e.status);
            if (e.used) expect(codesOf(r!)).toEqual([...e.used].sort());
            if (e.includes) expect(codesOf(r!)).toEqual(expect.arrayContaining(e.includes));
            if (e.chosenOption) expect(r!.chosenOption).toBe(e.chosenOption);
          });
        }

        for (const [id, e] of Object.entries(audit.designations ?? {})) {
          it(`designation ${id}: ${e.status}${e.tier ? ` (${e.tier})` : ""}`, () => {
            const d = result.designations.find((x) => x.id === id);
            expect(d, `designation ${id} not in audit`).toBeDefined();
            expect(d!.status).toBe(e.status);
            if (e.tier) expect(d!.tier).toBe(e.tier);
          });
        }

        it(`not counted: [${audit.notCounted.join(", ")}]`, () => {
          expect(result.notCounted.map((n) => n.code).sort()).toEqual([...audit.notCounted].sort());
        });

        it("no course is used by two requirements", () => {
          const codes = result.requirements.flatMap(function all(r): string[] {
            return r.children?.length ? r.children.flatMap(all) : [...r.used, ...(r.surplus ?? [])].map((u) => u.code);
          });
          expect(codes.length).toBe(new Set(codes).size);
        });
      });
    });
  }
});

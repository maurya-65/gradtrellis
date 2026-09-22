import { describe, expect, it } from "vitest";
import { cumulativeGpa, gpa, gradeAtLeast, LetterGrade } from "../../src/engine/index.ts";
import { att, F24, F25, index, record, scale, W25 } from "./helpers.ts";
import { forAll } from "./random.ts";

describe("UNB grade scale", () => {
  it("orders letter grades by points", () => {
    expect(gradeAtLeast("C+", "C", scale)).toBe(true);
    expect(gradeAtLeast("C", "C", scale)).toBe(true);
    expect(gradeAtLeast("D", "C", scale)).toBe(false);
    expect(gradeAtLeast("WF", "D", scale)).toBe(false);
    expect(gradeAtLeast("A+", "A", scale)).toBe(true);
  });
});

describe("GPA (Calendar Section B, H. Calculation of Grade Point Averages)", () => {
  it("weights by credit hours", () => {
    // CS 1073 is 4 ch, CS 1203 is 3 ch: (4*4.0 + 3*2.0) / 7 = 3.142...
    const r = record([att("CS 1073", F24, "A"), att("CS 1203", F24, "C")]);
    const g = cumulativeGpa(r, index, scale);
    expect(g.value).toBeCloseTo(22 / 7, 10);
    expect(g.display).toBe("3.1");
  });

  it("counts every attempt of a repeated course", () => {
    const r = record([att("CS 1083", W25, "F"), att("CS 1083", F25, "B")]);
    // (4*0 + 4*3.0) / 8 = 1.5
    expect(cumulativeGpa(r, index, scale).value).toBeCloseTo(1.5, 10);
  });

  it("leaves out W, CR, in-progress, X and #", () => {
    const r = record([
      att("CS 1073", F24, "B"),
      att("CS 1083", W25, "W"),
      att("CS 1303", F24, "F", { notations: ["#"] }),
      att("CS 1203", F24, "D", { notations: ["X"] }),
      att("CS 2043", F25, "IP"),
    ]);
    expect(cumulativeGpa(r, index, scale).value).toBeCloseTo(3.0, 10);
  });

  it("counts WF as 0 points", () => {
    const r = record([att("CS 1073", F24, "A"), att("CS 1083", W25, "WF")]);
    expect(cumulativeGpa(r, index, scale).value).toBeCloseTo(2.0, 10);
  });

  it("has no GPA with no graded work", () => {
    expect(cumulativeGpa(record([att("CS 1073", F24, "IP")]), index, scale).display).toBe("—");
  });

  const LETTERS = LetterGrade.options;
  const HOURS = [1, 2, 3, 4, 6] as const;

  it("property: always between 0 and 4.3", () => {
    forAll(1000, 1, (rng) => {
      const rows = rng.array(1, 60, () => ({ result: rng.pick(LETTERS), hours: rng.pick(HOURS) }));
      const attempts = rows.map((r, i) => ({ code: `ZZZ ${1000 + i}`, term: F24, result: r.result, notations: [] }));
      const g = gpa(attempts, (a) => rows[Number(a.code.slice(4)) - 1000]!.hours, scale);
      return g.value! >= 0 && g.value! <= 4.3 + 1e-9;
    });
  });

  it("property: adding withdrawals never changes GPA", () => {
    forAll(1000, 2, (rng) => {
      const base = rng.array(1, 20, () => rng.pick(LETTERS)).map((result, i) => ({ code: `ZZZ ${1000 + i}`, term: F24, result, notations: [] }));
      const withdrawals = Array.from({ length: rng.int(1, 5) }, (_, i) => ({ code: `WWW ${1000 + i}`, term: W25, result: "W" as const, notations: [] }));
      return gpa(base, () => 3, scale).value === gpa([...base, ...withdrawals], () => 3, scale).value;
    });
  });
});

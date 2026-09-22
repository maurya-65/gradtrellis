import { describe, expect, it } from "vitest";
import { courseIndex as index, programs, snapshot } from "../src/catalog.ts";
import { programForEntry, type Program, type Requirement, type Selector } from "../src/engine/index.ts";

// named in an encoded calendar but gone from the current listings
const NOT_CURRENTLY_LISTED: Record<string, string> = {
  "CS 1103": "Introduction to Databases, renumbered CS 1543",
  "CS 2704": "Saint John Data Analytics course, named in the non-credit list",
  "ECE 2213": "retired ECE course, named in the non-credit list",
  "MATH 3353": "Computational Algebra, on the Math Option B list but no longer listed",
  "INFO 1103": "Saint John code, named only as an accepted substitute for the databases course",
};

const bcs = (entry: { season: "Winter" | "Summer" | "Fall"; year: number }) => ({
  institution: "unb",
  campus: "fredericton",
  code: "BCS",
  entry,
});

function walk(reqs: Requirement[], visit: (r: Requirement) => void) {
  for (const r of reqs) {
    visit(r);
    if (r.type === "allOf") walk(r.items, visit);
    if (r.type === "oneOf") walk(r.options, visit);
  }
}

function selectorCodes(s: Selector): string[] {
  switch (s.type) {
    case "codes":
      return s.codes;
    case "all":
    case "any":
      return s.of.flatMap(selectorCodes);
    case "not":
      return selectorCodes(s.of);
    default:
      return [];
  }
}

function allRequirements(p: Program): Requirement[] {
  const out: Requirement[] = [];
  walk([...p.requirements, ...p.overlays, ...p.designations.flatMap((d) => d.requirements)], (r) => out.push(r));
  return out;
}

function programCodes(p: Program): Set<string> {
  const codes = new Set<string>();
  for (const r of allRequirements(p)) {
    if (r.type === "course") {
      codes.add(r.code);
      r.acceptAlso?.codes.forEach((c) => codes.add(c));
    }
    if (r.type === "pool") selectorCodes(r.select).forEach((c) => codes.add(c));
  }
  return codes;
}

describe("course snapshot", () => {
  it("is large and covers the subjects BCS needs", () => {
    expect(snapshot.courses.length).toBeGreaterThan(2000);
    for (const s of ["CS", "SWE", "MATH", "STAT", "ENGL"]) expect(snapshot.subjects).toContain(s);
  });

  it("has unique course codes", () => {
    const codes = snapshot.courses.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("flags courses BCS students can't take for credit", () => {
    const restricted = snapshot.courses
      .filter((c) => c.creditRestrictions.some((r) => r.programs.includes("BCS") && !r.exceptInFirstYear))
      .map((c) => c.code);
    expect(restricted).toEqual(expect.arrayContaining(["CS 1023", "CS 1093"]));

    const cs1203 = index.get("CS 1203")!;
    expect(cs1203.creditRestrictions).toContainEqual(expect.objectContaining({ programs: ["BCS"], exceptInFirstYear: true }));
  });

  it("reads the (P) and (W) markers", () => {
    expect(index.get("CS 1073")!.flags.programming).toBe(true);
    expect(index.get("CS 3997")!.flags.writing).toBe(true);
    expect(index.get("CS 4983")!.creditHours).toBe(2);
  });
});

describe.each(programs)("$id", (p) => {
  it("has unique requirement ids", () => {
    const ids = allRequirements(p).map((r) => r.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    // the same course can appear in a designation too
    expect(dupes.filter((d) => !d.startsWith("cs-"))).toEqual([]);
  });

  it("pool sizes add up to the 40-course total", () => {
    const core = p.requirements.find((r) => r.id === "cs-core");
    expect(core?.type === "allOf" && core.items.length).toBe(14);
    const pools = p.requirements.filter((r) => r.type === "pool");
    const poolCourses = pools.reduce((n, r) => n + (r.type === "pool" ? (r.minCourses ?? 0) : 0), 0);
    const mathCourses = 5; // calc I, calc II, linear algebra, two statistics courses
    expect(14 + mathCourses + poolCourses).toBe(p.totals.minCourses);
  });

  it("every top-level requirement and designation cites the calendar", () => {
    for (const r of [...p.requirements, ...p.overlays]) expect(r.source, r.id).toBeDefined();
    for (const d of p.designations) expect(d.source.url, d.id).toContain("unb.ca");
  });

  it("names only courses that exist, except retired ones with a listed replacement", () => {
    const missing = [...programCodes(p)].filter((c) => !index.has(c));
    const retiredWithReplacement = new Set(
      allRequirements(p)
        .filter((r) => r.type === "course" && r.acceptAlso?.codes.some((c) => index.has(c)))
        .map((r) => (r.type === "course" ? r.code : "")),
    );
    const unexplained = missing.filter((c) => !retiredWithReplacement.has(c) && !(c in NOT_CURRENTLY_LISTED));
    expect(unexplained).toEqual([]);
  });

  it("non-credit list refers to real courses", () => {
    const missing = p.nonCredit.codes.filter((c) => !index.has(c));
    expect(missing.filter((c) => !(c in NOT_CURRENTLY_LISTED))).toEqual([]);
  });

  it("designation patches target real pools and constraints", () => {
    for (const d of p.designations) {
      for (const patch of d.patches ?? []) {
        const pool = p.requirements.find((r) => r.id === patch.pool);
        expect(pool?.type, `${d.id} -> ${patch.pool}`).toBe("pool");
        const baseIds = new Set(pool?.type === "pool" ? (pool.constraints ?? []).map((c) => c.id) : []);
        for (const c of patch.constraints ?? []) expect(baseIds.has(c.id), `${d.id} replaces ${c.id}`).toBe(true);
      }
    }
  });

});

describe("choosing a calendar by entry term", () => {
  it("is chosen for a Sept 2024 entrant", () => {
    const { program, exact } = programForEntry(programs, bcs({ season: "Fall", year: 2024 }));
    expect(exact).toBe(true);
    expect(program.id).toBe("unb-fredericton-bcs-2024-2025");
  });

  it("is chosen for a Sept 2026 entrant", () => {
    const { program, exact } = programForEntry(programs, bcs({ season: "Fall", year: 2026 }));
    expect(exact).toBe(true);
    expect(program.id).toBe("unb-fredericton-bcs-2026-2027");
  });

  it("has an exact calendar for every entry year from 2021 to 2026", () => {
    for (const year of [2021, 2022, 2023, 2024, 2025, 2026]) {
      const { program, exact } = programForEntry(programs, bcs({ season: "Fall", year }));
      expect(exact, String(year)).toBe(true);
      expect(program.calendarYear).toBe(`${year}-${year + 1}`);
    }
  });

  it("falls back to the earliest calendar for an older entrant and says so", () => {
    const { program, exact } = programForEntry(programs, bcs({ season: "Fall", year: 2019 }));
    expect(exact).toBe(false);
    expect(program.id).toBe("unb-fredericton-bcs-2021-2022");
  });
});

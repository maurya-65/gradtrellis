import { describe, expect, it } from "vitest";
import {
  activeSlots,
  allChoices,
  allocate,
  compareScores,
  courseSlotAccepts,
  poolAccepts,
  scoreAssignment,
  withNamedCourses,
  type Assignment,
  type Score,
  type Slot,
} from "../../src/engine/audit/allocate.ts";
import { runAudit, usableCourses } from "../../src/engine/index.ts";
import { att, F24, F25, index, NOW, program, record, S25, scale, W25, W26 } from "./helpers.ts";
import { forAll, type Rng } from "./random.ts";

// picked so requirements actually compete for courses (CS 3113 fits TE and Math Option B,
// ENGL 1000 is 6 ch, CS 4983 is the 2 ch odd one out, ...)
const POOL = [
  "CS 1073", "CS 1203", "CS 2613", "CS 2413", "CS 3113", "CS 3035", "CS 3413", "CS 4355", "CS 4411", "CS 4983", "CS 4997",
  "MATH 1003", "MATH 1053", "MATH 1503", "MATH 2213", "STAT 2593", "STAT 3083", "STAT 3093", "MATH 3343",
  "ECON 1013", "ENGL 1103", "HIST 2013", "ANTH 2304", "ENGL 1000", "ECE 1813",
] as const;

const RESULTS = ["A", "B", "C", "IP"] as const;
const TERMS = [F24, W25, F25, W26] as const;

function randomRecord(rng: Rng, min: number, max: number) {
  const codes = [...POOL].sort(() => rng.next() - 0.5).slice(0, rng.int(min, max));
  return record(codes.map((c) => att(c, rng.pick(TERMS), rng.pick(RESULTS))));
}

// try every placement of every course
function bruteForce(slots: Slot[], usable: ReturnType<typeof usableCourses>["usable"]): Score {
  const ctx = withNamedCourses(slots, { scale });
  const options = usable.map((c) => [
    undefined,
    ...slots.filter((s) => (s.kind === "course" ? courseSlotAccepts(s, c, ctx) : poolAccepts(s, c, ctx) === "yes")).map((s) => s.id),
  ]);
  let best: Score | null = null;
  const assignment: Assignment = new Map();
  const taken = new Set<string>();
  const courseSlotIds = new Set(slots.filter((s) => s.kind === "course").map((s) => s.id));

  const recurse = (i: number) => {
    if (i === usable.length) {
      const s = scoreAssignment(slots, usable, assignment, ctx);
      if (!best || compareScores(s, best) < 0) best = s;
      return;
    }
    for (const slot of options[i]!) {
      if (slot && courseSlotIds.has(slot) && taken.has(slot)) continue;
      if (slot) {
        assignment.set(usable[i]!.code, slot);
        if (courseSlotIds.has(slot)) taken.add(slot);
      }
      recurse(i + 1);
      if (slot) {
        assignment.delete(usable[i]!.code);
        taken.delete(slot);
      }
    }
  };
  recurse(0);
  return best!;
}

// brute force is slow; DEEP_TESTS=1 runs the full 400 cases
const EXHAUSTIVE_CASES = process.env.DEEP_TESTS ? 400 : 120;

describe("allocate", () => {
  it(`matches exhaustive search on random records (${EXHAUSTIVE_CASES} cases)`, { timeout: 600_000 }, () => {
    forAll(EXHAUSTIVE_CASES, 11, (rng, run) => {
      const r = randomRecord(rng, 3, 8);
      const { usable } = usableCourses(r, program, index, scale, NOW);
      const ctx = { scale };
      for (const choice of allChoices(program.requirements)) {
        const slots = activeSlots(program.requirements, choice);
        const solved = allocate(slots, usable, ctx).score;
        const optimal = bruteForce(slots, usable);
        if (compareScores(solved, optimal) !== 0) {
          throw new Error(
            `case ${run}: solver ${JSON.stringify(solved)} vs optimal ${JSON.stringify(optimal)} for ${r.attempts.map((a) => `${a.code}:${a.result}`).join(", ")} choice ${JSON.stringify([...choice])}`,
          );
        }
      }
      return true;
    });
  });

  it("never uses a course twice and only places courses where they're accepted", () => {
    forAll(300, 12, (rng) => {
      const r = randomRecord(rng, 5, POOL.length);
      const audit = runAudit(r, { programs: [program], index, scale, asOf: NOW });
      const placed = audit.requirements.flatMap(function leaves(x): string[] {
        return x.children?.length ? x.children.flatMap(leaves) : [...x.used, ...(x.surplus ?? [])].map((u) => u.code);
      });
      return placed.length === new Set(placed).size;
    });
  });

  it("every transcript line is either placed or explained", () => {
    forAll(300, 13, (rng) => {
      const r = randomRecord(rng, 5, POOL.length);
      const audit = runAudit(r, { programs: [program], index, scale, asOf: NOW });
      const placed = new Set(
        [...audit.requirements, ...audit.overlays].flatMap(function leaves(x): string[] {
          return x.children?.length ? x.children.flatMap(leaves) : [...x.used, ...(x.surplus ?? [])].map((u) => u.code);
        }),
      );
      return r.attempts.every((a) => placed.has(a.code) || audit.notCounted.some((n) => n.code === a.code));
    });
  });
});

describe("audit rules", () => {
  const audit = (attempts: Parameters<typeof record>[0], extra = {}) => runAudit(record(attempts, extra), { programs: [program], index, scale, asOf: NOW });
  const find = (a: ReturnType<typeof audit>, id: string) =>
    [...a.requirements, ...a.overlays].flatMap(function all(r): typeof a.requirements {
      return [r, ...(r.children ?? []).flatMap(all)];
    }).find((r) => r.id === id)!;

  it("a 6 ch course counts as two breadth courses", () => {
    const b = find(audit([att("ENGL 1000", F24, "B")]), "breadth");
    expect(b.remaining).toContain("8 more courses");
  });

  it("CS 4983 is allowed as a technical elective but not as the 4th-year course", () => {
    const te = find(audit([att("CS 4983", F25, "A")]), "tech-electives");
    expect(te.used.map((u) => u.code)).toContain("CS 4983");
    expect(te.constraints!.find((c) => c.id === "te-fourth-year")!.have).toBe(0);
    expect(te.constraints!.find((c) => c.id === "te-third-year")!.have).toBe(1);
  });

  it("ECE courses don't count toward breadth, but are flagged as needing approval", () => {
    const b = find(audit([att("ECE 1813", F25, "A")]), "breadth");
    expect(b.used).toEqual([]);
    expect(b.couldCountWithApproval?.map((c) => c.code)).toEqual(["ECE 1813"]);
  });

  it("doesn't suggest approval for a course that already counts elsewhere", () => {
    // STAT 2593 already counts as the Option B course
    const elective = find(audit([att("STAT 2593", F25, "IP")]), "statistics-option-b-elective");
    expect(elective.couldCountWithApproval).toBeUndefined();
  });

  it("lists which courses count toward a pool's level rule", () => {
    const breadth = find(audit([att("ANTH 1001", F24, "A"), att("ANTH 2304", W25, "B")]), "breadth");
    expect(breadth.used.map((u) => u.code).sort()).toEqual(["ANTH 1001", "ANTH 2304"]);
    expect(breadth.constraints!.find((c) => c.id === "breadth-upper-year")).toMatchObject({ have: 1, need: 2, courses: ["ANTH 2304"] });
    expect(breadth.progress).toEqual([
      { unit: "courses", have: 2, need: 10 },
      { unit: "ch", have: 6, need: 30 },
    ]);
  });

  it("a course registered for a later term is planned, not in progress", () => {
    const W27 = { season: "Winter" as const, year: 2027 };
    const a = audit([att("CS 1073", NOW, "IP"), att("CS 1083", W27, "IP")]);
    expect(find(a, "cs-1073").status).toBe("in-progress");
    expect(find(a, "cs-1083")).toMatchObject({ status: "planned", remaining: "planned: CS 1083" });
    expect(a.totals.courses).toMatchObject({ have: 0, inProgress: 1, planned: 1 });
  });

  it("a pool is in progress if current courses finish it, planned if it needs planned ones", () => {
    const W27 = { season: "Winter" as const, year: 2027 };
    // writing needs 12 ch of (W) courses
    const current = [att("ENGL 1000", F25, "A"), att("ENGL 1103", NOW, "IP"), att("ENGL 1104", NOW, "IP")];
    expect(find(audit(current), "writing").status).toBe("in-progress");

    const writing = find(audit([att("ENGL 1000", F25, "A"), att("ENGL 1103", NOW, "IP"), att("ENGL 1104", W27, "IP")]), "writing");
    expect(writing).toMatchObject({ status: "planned", remaining: "in progress: ENGL 1103; planned: ENGL 1104" });
  });

  it("a D doesn't count, even though it earns university credit", () => {
    const a = audit([att("CS 1073", F24, "D")]);
    expect(a.notCounted[0]).toMatchObject({ code: "CS 1073", reason: expect.stringContaining("below the C") });
    expect(find(a, "cs-1073").status).toBe("incomplete");
  });

  it("the better attempt of a repeated course counts", () => {
    const a = audit([att("CS 1073", F24, "C"), att("CS 1073", W25, "A")]);
    expect(a.totals.courses.have).toBe(1);
    expect(a.notCounted).toEqual([expect.objectContaining({ code: "CS 1073", result: "C" })]);
  });

  it("CS 1203 after first year counts for nothing", () => {
    const a = audit([att("CS 1203", F25, "A")]);
    expect(a.notCounted[0]!.reason).toContain("beyond first year");
  });

  it("an unconfirmed substitution is marked for review", () => {
    const leaf = find(audit([att("CS 1543", F25, "A")]), "cs-1103");
    expect(leaf.status).toBe("review");
    expect(leaf.used[0]!.code).toBe("CS 1543");
  });

  it("Math Option B wins when STAT 2593 is done and a listed elective is too", () => {
    const stats = find(audit([att("STAT 2593", F25, "B"), att("MATH 3343", W26, "B")]), "statistics");
    expect(stats.status).toBe("complete");
    expect(stats.chosenOption).toMatch(/^Option B/);
  });

  it("flags an Honours tier that depends on rounding the CGPA", () => {
    // B+ in 4 ch and A- in 3 ch: 24.3 / 7 = 3.471 exact, shown as 3.5
    const tiersOnly = {
      ...program,
      designations: [{ ...program.designations.find((d) => d.id === "honours")!, requirements: [], patches: [] }],
    };
    const a = runAudit(record([att("CS 1073", F24, "B+"), att("CS 1203", F24, "A-")], { designations: ["honours"] }), {
      index,
      scale,
      programs: [tiersOnly],
      asOf: NOW,
    });
    const honours = a.designations[0]!;
    expect(a.cgpa).toBe("3.5");
    expect(honours.tier).toBe("Honours");
    expect(honours.notes[0]).toContain("would give First Class Honours");
  });

  it("Honours needs CS 4997 with B or better", () => {
    const a = audit([att("CS 4997", S25, "C+")], { designations: ["honours"] });
    const honours = a.designations.find((d) => d.id === "honours")!;
    expect(honours.status).toBe("incomplete");
    expect(honours.requirements[0]!.remaining).toContain("CS 4997 with B or better");
  });
});

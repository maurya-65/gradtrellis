import { describe, expect, it } from "vitest";
import { checkRequisite, parseRequisite, type Requisite } from "../../src/engine/requisites.ts";
import { att, F24, F25, index, record, scale, W25, W26 } from "./helpers.ts";

const course = (code: string): Requisite => ({ type: "course", code });

describe("parseRequisite", () => {
  it("reads lists, brackets and credit hours", () => {
    expect(parseRequisite("CS 1073.")).toEqual(course("CS 1073"));
    expect(parseRequisite("CS 2043 or CS 2263 or ECE 4403.")).toEqual({ type: "any", of: [course("CS 2043"), course("CS 2263"), course("ECE 4403")] });
    expect(parseRequisite("CS 1073, (CS 1303 or MATH 2203), and 30 ch.")).toEqual({
      type: "all",
      of: [course("CS 1073"), { type: "any", of: [course("CS 1303"), course("MATH 2203")] }, { type: "creditHours", min: 30 }],
    });
  });

  it("reads 'A or B, and C or D' as two groups, and semicolons", () => {
    const either = (a: string, b: string): Requisite => ({ type: "any", of: [course(a), course(b)] });
    expect(parseRequisite("MATH 2013 or MATH 3503, and MATH 2213 or MATH 1503.")).toEqual({
      type: "all",
      of: [either("MATH 2013", "MATH 3503"), either("MATH 2213", "MATH 1503")],
    });
    expect(parseRequisite("MATH 1013; and either MATH 1503 or MATH 2213.")).toEqual({ type: "all", of: [course("MATH 1013"), either("MATH 1503", "MATH 2213")] });
  });

  it("drops notes and asides, and keeps permission as an alternative to review", () => {
    expect(parseRequisite("MATH 1013. NOTE: Credit can be obtained in only one of STAT 2593 or STAT 3083.")).toEqual(course("MATH 1013"));
    expect(parseRequisite("MATH 2203 or CS 1303 (MATH 2203 recommended); or permission of the instructor.")).toEqual({
      type: "any",
      of: [
        { type: "any", of: [course("MATH 2203"), course("CS 1303")] },
        { type: "text", text: "permission of the instructor" },
      ],
    });
  });

  it("reads grade minimums before and after the course", () => {
    expect(parseRequisite("STAT 2593 (at least B) or STAT 3093.")).toEqual({
      type: "any",
      of: [{ type: "course", code: "STAT 2593", minGrade: "B" }, course("STAT 3093")],
    });
    expect(parseRequisite("MATH 1013 or a grade of B or better in MATH 1823.")).toEqual({
      type: "any",
      of: [course("MATH 1013"), { type: "course", code: "MATH 1823", minGrade: "B" }],
    });
  });

  it("reads cross-listed codes, subject credit hours, program enrolment and equivalents", () => {
    expect(parseRequisite("MAAC/CCS 2021.")).toEqual({ type: "any", of: [course("MAAC 2021"), course("CCS 2021")] });
    expect(parseRequisite("12 ch in Mathematics and/or Statistics.")).toEqual({ type: "creditHours", min: 12, subjects: ["MATH", "STAT"] });
    expect(parseRequisite("Enrolment in the BCS program and 40 ch completed.")).toEqual({
      type: "all",
      of: [{ type: "program", code: "BCS" }, { type: "creditHours", min: 40 }],
    });
    expect(parseRequisite("ANTH 1002 (or equivalent).")).toEqual({ type: "any", of: [course("ANTH 1002"), { type: "text", text: "an equivalent course" }] });
  });

  it("reads comma groups when the list ends ', and'", () => {
    const either = (a: string, b: string): Requisite => ({ type: "any", of: [course(a), course(b)] });
    expect(parseRequisite("MATH 1013 or MATH 1063, MATH 2203 or CS 1303, and MATH 2213 or MATH 1503.")).toEqual({
      type: "all",
      of: [either("MATH 1013", "MATH 1063"), either("MATH 2203", "CS 1303"), either("MATH 2213", "MATH 1503")],
    });
  });

  it("leaves prose and ambiguous lists as text", () => {
    expect(parseRequisite("Permission of the instructor.").type).toBe("text");
    expect(parseRequisite("MATH 2203 or CS 1303 and MATH 2213 or MATH 1503.").type).toBe("text");
    // one list of three, or two groups? no ", and" to settle it
    expect(parseRequisite("PHYS 1081 or equivalent, MATH 1013 or MATH 1063.").type).toBe("text");
  });
});

describe("checkRequisite", () => {
  const cs3383 = parseRequisite("CS 2333, CS 2383 and (STAT 2593 or STAT 3083).");
  const check = (req: Requisite, attempts: Parameters<typeof record>[0], term = W26, alongside = false) =>
    checkRequisite(req, { attempts: record(attempts).attempts, term, program: "BCS", index, scale, alongside });

  it("checks grade minimums, and can't tell from CR", () => {
    const atLeastB = parseRequisite("STAT 2593 (at least B).");
    expect(check(atLeastB, [att("STAT 2593", F25, "B+")])).toBe("met");
    expect(check(atLeastB, [att("STAT 2593", F25, "C")])).toBe("missing");
    expect(check(atLeastB, [att("STAT 2593", F25, "CR")])).toBe("review");
  });

  it("counts credit hours in the named subjects only, and checks the program", () => {
    const math = parseRequisite("6 ch in Mathematics.");
    expect(check(math, [att("MATH 1003", F24, "B"), att("CS 1073", F24, "A")])).toBe("missing");
    expect(check(math, [att("MATH 1003", F24, "B"), att("MATH 1013", W25, "A")])).toBe("met");
    expect(check({ type: "program", code: "BCS" }, [])).toBe("met");
    expect(check({ type: "program", code: "BScSwE" }, [])).toBe("missing");
  });

  it("lets a corequisite be taken in the same term", () => {
    const cs2263 = parseRequisite("CS 2263.");
    expect(check(cs2263, [att("CS 2263", W26, "IP")])).toBe("missing");
    expect(check(cs2263, [att("CS 2263", W26, "IP")], W26, true)).toBe("met");
    expect(check(cs2263, [att("CS 2263", F25, "IP")], W26, true)).toBe("pending");
  });

  it("is met by passed courses taken before the term", () => {
    expect(check(cs3383, [att("CS 2333", F24, "B"), att("CS 2383", W25, "C"), att("STAT 2593", F25, "A")])).toBe("met");
  });

  it("is pending while a needed course is in progress or planned before the term", () => {
    expect(check(cs3383, [att("CS 2333", F24, "B"), att("CS 2383", W25, "C"), att("STAT 3083", F25, "IP")])).toBe("pending");
  });

  it("is missing after a fail, or when the course comes in the same term", () => {
    expect(check(cs3383, [att("CS 2333", F24, "F"), att("CS 2383", W25, "C"), att("STAT 2593", F25, "A")])).toBe("missing");
    expect(check(cs3383, [att("CS 2333", F24, "B"), att("CS 2383", W25, "C"), att("STAT 2593", W26, "IP")])).toBe("missing");
  });

  it("counts credit hours, and leaves text for review unless another branch is met", () => {
    const thirty = parseRequisite("30 ch.");
    const ten = Array.from({ length: 10 }, (_, i) => att(`CS ${1003 + i * 10}`, F24, "B", { creditHours: 3 }));
    expect(check(thirty, ten)).toBe("met");
    expect(check(thirty, ten.slice(1))).toBe("missing");

    const orPermission = parseRequisite("CS 1073 or permission of the instructor.");
    expect(check(orPermission, [att("CS 1073", F24, "A")])).toBe("met");
    expect(check(orPermission, [])).toBe("review");
  });
});

import type { CourseIndex } from "../courses.ts";
import type { GpaResult } from "../grades.ts";
import { cumulativeGpa, policyWarnings } from "../policy.ts";
import { programForEntry } from "../programs.ts";
import type { StudentRecord } from "../record.ts";
import type { GradingScale } from "../schema/grades.ts";
import type { Program } from "../schema/program.ts";
import { activeSlots, allChoices, allocate, compareScores, type AllocationContext, type Assignment, type Choice, type Score } from "./allocate.ts";
import { evaluateRequirement, worstStatus, type EvalEnv } from "./evaluate.ts";
import type { Term } from "../terms.ts";
import type { AuditResult, DesignationResult, RequirementStatus, Totals, UsableCourse } from "./types.ts";
import { usableCourses } from "./usable.ts";

export * from "./types.ts";
export { neededCourses } from "./needed.ts";
export { usableCourses } from "./usable.ts";

type Designation = Program["designations"][number];

export interface AuditOptions {
  programs: Program[];
  // the current term; courses registered for later terms are "planned"
  asOf: Term;
  index: CourseIndex;
  scale: GradingScale;
}

export function runAudit(record: StudentRecord, opts: AuditOptions): AuditResult {
  const { index, scale } = opts;
  const found = programForEntry(opts.programs, record.program);
  const program = found.program;

  const ctx: AllocationContext = { scale };
  const { usable, notCounted } = usableCourses(record, program, index, scale, opts.asOf);
  const byCode = new Map(usable.map((c) => [c.code, c]));
  const cgpa = cumulativeGpa(record, index, scale);

  const pursued = program.designations.filter((d) => record.designations.includes(d.id));
  const patches = pursued.flatMap((d) => d.patches ?? []);

  // try Option A vs B etc. and keep the best
  let best: { choice: Choice; assignment: Assignment; score: Score } | null = null;
  for (const choice of allChoices(program.requirements)) {
    const slots = activeSlots(program.requirements, choice, patches);
    const { assignment, score } = allocate(slots, usable, ctx);
    if (!best || compareScores(score, best.score) < 0) best = { choice, assignment, score };
  }
  const { choice, assignment } = best!;

  for (const c of usable) {
    if (!assignment.has(c.code)) notCounted.push({ code: c.code, term: c.attempt.term, result: c.attempt.result, reason: "doesn't fit any requirement" });
  }

  const env = (patched: boolean, consuming: boolean): EvalEnv => ({
    ctx,
    usable,
    byCode,
    slots: new Map(activeSlots(program.requirements, choice, patched ? patches : []).map((s) => [s.id, s])),
    choice,
    assignment: consuming ? assignment : null,
    cgpa: cgpa.value,
    program,
  });

  const requirements = program.requirements.map((r) => evaluateRequirement(r, env(false, true)));
  const overlays = program.overlays.map((r) => evaluateRequirement(r, env(false, false)));

  const designations = pursued.map((d) => evaluateDesignation(d, program, cgpa, env));

  const totals = computeTotals(program, usable.filter((c) => assignment.has(c.code)));
  const status = worstStatus([...requirements, ...overlays].map((r) => r.status).concat(totals.status));

  return {
    studentId: record.id,
    program: { id: program.id, name: program.name, calendarYear: program.calendarYear },
    exactCalendar: found.exact,
    status,
    cgpa: cgpa.display,
    totals,
    requirements,
    overlays,
    designations,
    notCounted: notCounted.sort((a, b) => a.code.localeCompare(b.code)),
    warnings: policyWarnings(record, program, index, scale),
    interpretations: program.interpretationNotes,
  };
}

// Patched pools are re-evaluated with the designation's patches; its extra requirements look at every course.
function evaluateDesignation(
  d: Designation,
  program: Program,
  cgpa: GpaResult,
  env: (patched: boolean, consuming: boolean) => EvalEnv,
): DesignationResult {
  const patchedPools = (d.patches ?? []).flatMap((p) => {
    const pool = findRequirement(program.requirements, p.pool);
    if (!pool) return [];
    const result = evaluateRequirement(pool, env(true, true));
    return [{ ...result, title: `${result.title} (${d.name})` }];
  });
  const extra = d.requirements.map((r) => evaluateRequirement(r, env(false, false)));
  const requirements = [...patchedPools, ...extra];
  const status = worstStatus(requirements.map((r) => r.status));
  const { tier, notes } = status === "complete" ? designationTier(d, cgpa) : { tier: undefined, notes: [] };
  return { id: d.id, name: d.name, status, requirements, tier, notes };
}

// Exact CGPA decides the tier; flag it if the rounded one would disagree.
function designationTier(d: Designation, cgpa: GpaResult): { tier: string | undefined; notes: string[] } {
  if (cgpa.value === null || !d.tiers) return { tier: undefined, notes: [] };
  const exact = cgpa.value;
  const tier = d.tiers.find((t) => exact >= t.minCgpa)?.label;
  const rounded = Number(cgpa.display);
  const roundedTier = d.tiers.find((t) => rounded >= t.minCgpa)?.label;
  if (roundedTier === tier) return { tier, notes: [] };
  return {
    tier,
    notes: [
      `Exact CGPA ${exact.toFixed(3)} gives ${tier ?? "no tier"}; the one-decimal CGPA ${cgpa.display} would give ${roundedTier}. The calendar doesn't say which applies: ask the Faculty.`,
    ],
  };
}

function findRequirement(reqs: Program["requirements"], id: string): Program["requirements"][number] | undefined {
  for (const r of reqs) {
    if (r.id === id) return r;
    const inner = r.type === "allOf" ? findRequirement(r.items, id) : r.type === "oneOf" ? findRequirement(r.options, id) : undefined;
    if (inner) return inner;
  }
  return undefined;
}

function computeTotals(program: Program, counted: UsableCourse[]): Totals {
  const total = (state: UsableCourse["state"], f: (c: UsableCourse) => number) =>
    counted.filter((c) => c.state === state).reduce((n, c) => n + f(c), 0);
  const count = (f: (c: UsableCourse) => number, need: number) => ({
    have: total("completed", f),
    inProgress: total("in-progress", f),
    planned: total("planned", f),
    need,
  });
  const courses = count((c) => c.weight, program.totals.minCourses);
  const creditHours = count((c) => c.facts.creditHours, program.totals.minCreditHours);

  // met counting completed courses only, then adding in-progress, then planned
  const metWith = (parts: Array<"have" | "inProgress" | "planned">) =>
    [courses, creditHours].every((t) => parts.reduce((n, k) => n + t[k], 0) >= t.need);
  const status: RequirementStatus = metWith(["have"])
    ? "complete"
    : metWith(["have", "inProgress"])
      ? "in-progress"
      : metWith(["have", "inProgress", "planned"])
        ? "planned"
        : "incomplete";
  return { courses, creditHours, status };
}

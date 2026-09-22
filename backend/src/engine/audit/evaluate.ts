import type { CourseCode } from "../schema/common.ts";
import type { Program, Requirement } from "../schema/program.ts";
import {
  courseSlotAccepts,
  measurePool,
  poolAccepts,
  type AllocationContext,
  type Assignment,
  type Choice,
  type PoolMeasure,
  type PoolSlot,
  type Slot,
} from "./allocate.ts";
import type { ConstraintResult, RequirementResult, RequirementStatus, UsableCourse, UsedCourse } from "./types.ts";

type CourseRequirement = Extract<Requirement, { type: "course" }>;
type PoolRequirement = Extract<Requirement, { type: "pool" }>;

export interface EvalEnv {
  ctx: AllocationContext;
  usable: UsableCourse[];
  byCode: Map<CourseCode, UsableCourse>;
  slots: Map<string, Slot>;
  choice: Choice;
  // null for overlays/designations, which look at every course
  assignment: Assignment | null;
  cgpa: number | null;
  program: Program;
}

const ORDER: RequirementStatus[] = ["complete", "in-progress", "review", "incomplete"];

export function worstStatus(statuses: RequirementStatus[]): RequirementStatus {
  return statuses.reduce<RequirementStatus>((w, s) => (ORDER.indexOf(s) > ORDER.indexOf(w) ? s : w), "complete");
}

function used(c: UsableCourse, note?: string): UsedCourse {
  return { code: c.code, state: c.state, creditHours: c.facts.creditHours, weight: c.weight, ...(note ? { note } : {}) };
}

function assignedTo(env: EvalEnv, id: string): UsableCourse[] {
  if (!env.assignment) return [];
  return [...env.assignment].filter(([, s]) => s === id).map(([code]) => env.byCode.get(code)!);
}

function baseOf(req: Requirement) {
  return { id: req.id, source: req.source, notes: [] as string[] };
}

export function evaluateRequirement(req: Requirement, env: EvalEnv): RequirementResult {
  const base = baseOf(req);

  switch (req.type) {
    case "course":
      return evaluateCourse(req, env);

    case "allOf": {
      const children = req.items.map((r) => evaluateRequirement(r, env));
      const status = worstStatus(children.map((c) => c.status));
      const missing = children.filter((c) => c.status === "incomplete");
      const missingCourses = missing.filter((c) => c.kind === "course").map((c) => c.title);
      const missingOther = missing.filter((c) => c.kind !== "course").map((c) => `${c.title}: ${c.remaining}`);
      const running = children.filter((c) => c.status === "in-progress").flatMap((c) => c.used.map((u) => u.code));
      const toReview = children.filter((c) => c.status === "review" && c.remaining).map((c) => c.remaining);
      const parts = [
        missingCourses.length ? `${missingCourses.join(", ")} remaining` : "",
        ...missingOther,
        ...toReview,
        running.length && !missing.length ? `in progress: ${running.join(", ")}` : "",
      ].filter(Boolean);
      return { ...base, kind: "allOf", title: req.title, status, remaining: parts.join("; "), used: children.flatMap((c) => c.used), children };
    }

    case "oneOf": {
      const index = env.choice.get(req.id) ?? bestOptionIndex(req, env);
      const option = req.options[index]!;
      const chosen = evaluateRequirement(option, env);
      const others = req.options.filter((_, i) => i !== index).map(label);
      return {
        ...base,
        kind: "oneOf",
        title: req.title,
        status: chosen.status,
        remaining: chosen.remaining,
        used: chosen.used,
        chosenOption: label(option),
        children: [chosen],
        notes: chosen.status === "complete" ? [] : [`alternatively: ${others.join(" or ")}`],
      };
    }

    case "pool":
      return evaluatePool(req, env);

    case "cgpa": {
      const met = env.cgpa !== null && env.cgpa >= req.min;
      return {
        ...base,
        kind: "cgpa",
        title: req.title,
        status: met ? "complete" : "incomplete",
        remaining: met ? "" : `CGPA ${env.cgpa === null ? "not yet available" : env.cgpa.toFixed(2)}, needs ${req.min.toFixed(1)}`,
        used: [],
      };
    }
  }
}

function evaluateCourse(req: CourseRequirement, env: EvalEnv): RequirementResult {
  const base = baseOf(req);
  const course = findCourseFor(req, env);

  if (!course) {
    const blocker = excludingCourse(req, env);
    if (blocker) {
      return {
        ...base,
        kind: "course",
        title: req.code,
        status: "review",
        remaining: `${req.code}: you have credit for ${blocker.code}, and credit is given for only one of them. Ask the Faculty whether ${blocker.code} satisfies this requirement.`,
        used: [],
        notes: [`${blocker.code} excludes ${req.code}; the calendar doesn't list it as a substitute for this requirement`],
      };
    }
    return { ...base, kind: "course", title: req.code, status: "incomplete", remaining: `${req.code}${req.minGrade ? ` with ${req.minGrade} or better` : ""}`, used: [] };
  }

  const substitute = course.code !== req.code;
  const note = substitute ? `accepted for ${req.code}: ${req.acceptAlso?.reason ?? ""}` : undefined;
  const status: RequirementStatus =
    substitute && req.acceptAlso && !req.acceptAlso.confirmed ? "review" : course.state === "completed" ? "complete" : "in-progress";
  if (status === "review") base.notes.push(`${course.code} for ${req.code} is GradTrellis's reading of the calendar, not confirmed by the Faculty`);
  return {
    ...base,
    kind: "course",
    title: req.code,
    status,
    remaining: status === "in-progress" ? `${course.code} in progress` : "",
    used: [used(course, note)],
  };
}

// With an allocation, it's whatever was assigned to the slot. Without one (overlays), any course that fits.
function findCourseFor(req: CourseRequirement, env: EvalEnv): UsableCourse | undefined {
  const slot = env.slots.get(req.id);
  if (env.assignment && slot) return assignedTo(env, req.id)[0];
  return (
    env.usable.find((c) => slot?.kind === "course" && courseSlotAccepts(slot, c, env.ctx)) ??
    env.usable.find((c) => c.code === req.code || req.acceptAlso?.codes.includes(c.code))
  );
}

// e.g. MATH 2203 blocks CS 1303, but the calendar never says it replaces it
function excludingCourse(req: CourseRequirement, env: EvalEnv): UsableCourse | undefined {
  return env.usable.find(
    (c) =>
      c.facts.course?.creditExclusions.includes(req.code) ||
      env.program.creditExclusions.some((e) => e.codes.includes(req.code) && e.codes.includes(c.code)),
  );
}

function evaluatePool(req: PoolRequirement, env: EvalEnv): RequirementResult {
  const slot = poolSlotFor(req, env);
  const pool = slot.pool;
  const courses = env.assignment ? assignedTo(env, req.id) : env.usable.filter((c) => poolAccepts(slot, c, env.ctx) === "yes");
  const all = measurePool(slot, courses, env.ctx);
  const done = measurePool(slot, courses.filter((c) => c.state === "completed"), env.ctx);
  const status: RequirementStatus = all.deficit > 1e-9 ? "incomplete" : done.deficit > 1e-9 ? "in-progress" : "complete";
  const { kept, surplus } = splitSurplus(slot, courses, env);
  const couldCount = approvalCandidates(slot, courses, env);

  return {
    ...baseOf(req),
    kind: "pool",
    title: pool.title,
    status,
    remaining: poolRemaining(status, pool, all, courses),
    used: kept.map((c) => used(c)),
    surplus: surplus.length ? surplus.map((c) => used(c)) : undefined,
    constraints: constraintResults(all, done),
    couldCountWithApproval: couldCount.length ? couldCount : undefined,
    source: pool.source,
  };
}

// Overlays have no allocation slot, so build a stand-in.
function poolSlotFor(req: PoolRequirement, env: EvalEnv): PoolSlot {
  const slot = env.slots.get(req.id);
  if (slot?.kind === "pool") return slot;
  return { kind: "pool", id: req.id, pool: req, mustInclude: [], catchAll: req.select.type === "anyCourse" };
}

function poolRemaining(status: RequirementStatus, pool: PoolRequirement, all: PoolMeasure, courses: UsableCourse[]): string {
  if (status === "complete") return "";
  if (status === "in-progress") return `in progress: ${courses.filter((c) => c.state === "in-progress").map((c) => c.code).join(", ")}`;

  const parts: string[] = [];
  if (pool.minCourses && all.courses < pool.minCourses) {
    const n = pool.minCourses - all.courses;
    parts.push(`${n} more course${n === 1 ? "" : "s"}`);
  }
  if (pool.minCreditHours && all.creditHours < pool.minCreditHours) parts.push(`${pool.minCreditHours - all.creditHours} more ch`);
  for (const m of all.mustInclude) if (!m.met) parts.push(`${m.code}${m.minGrade ? ` with ${m.minGrade} or better` : ""}`);
  // constraints are listed separately; only mention them if nothing else is left
  if (parts.length === 0) for (const c of all.constraints) if (c.have < c.need) parts.push(`${c.c.title} (${c.have} of ${c.need})`);
  return parts.join("; ");
}

// Courses that could count here with approval, skipping ones that already fill something specific.
function approvalCandidates(slot: PoolSlot, courses: UsableCourse[], env: EvalEnv): Array<{ code: CourseCode; by: string }> {
  const placedSpecifically = (code: CourseCode) => {
    const placed = env.slots.get(env.assignment?.get(code) ?? "");
    return !!placed && !(placed.kind === "pool" && placed.catchAll);
  };
  const by = slot.pool.approval?.[0]?.by ?? "the Faculty";
  return env.usable
    .filter((c) => !courses.includes(c) && !placedSpecifically(c.code) && poolAccepts(slot, c, env.ctx) === "approval")
    .map((c) => ({ code: c.code, by }));
}

function constraintResults(all: PoolMeasure, done: PoolMeasure): ConstraintResult[] {
  return all.constraints.map((c) => {
    const completed = done.constraints.find((d) => d.c.id === c.c.id)!;
    const status: RequirementStatus = c.have < c.need ? "incomplete" : completed.have >= c.need ? "complete" : "in-progress";
    return { id: c.c.id, title: c.c.title, have: c.have, need: c.need, unit: c.unit, status };
  });
}

function label(r: Requirement): string {
  return r.type === "course" ? r.code : r.title;
}

function bestOptionIndex(req: Extract<Requirement, { type: "oneOf" }>, env: EvalEnv): number {
  const rank = req.options.map((o) => ORDER.indexOf(evaluateRequirement(o, env).status));
  return rank.indexOf(Math.min(...rank));
}

// Which courses in a full pool are extra (for display only).
function splitSurplus(slot: PoolSlot, courses: UsableCourse[], env: EvalEnv): { kept: UsableCourse[]; surplus: UsableCourse[] } {
  if (measurePool(slot, courses, env.ctx).deficit > 1e-9) return { kept: courses, surplus: [] };
  const kept = [...courses];
  const surplus: UsableCourse[] = [];
  const candidates = [...courses].sort(
    (a, b) => Number(b.state === "in-progress") - Number(a.state === "in-progress") || a.facts.creditHours - b.facts.creditHours || b.code.localeCompare(a.code),
  );
  for (const c of candidates) {
    const without = kept.filter((k) => k !== c);
    if (measurePool(slot, without, env.ctx).deficit <= 1e-9 && measurePool(slot, without.filter((k) => k.state === "completed"), env.ctx).deficit <= measurePool(slot, kept.filter((k) => k.state === "completed"), env.ctx).deficit + 1e-9) {
      kept.splice(kept.indexOf(c), 1);
      surplus.push(c);
    }
  }
  return { kept: kept.sort((a, b) => a.code.localeCompare(b.code)), surplus: surplus.sort((a, b) => a.code.localeCompare(b.code)) };
}

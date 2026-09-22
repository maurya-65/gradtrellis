import { meetsGrade } from "../grades.ts";
import type { CourseCode } from "../schema/common.ts";
import type { GradingScale, LetterGrade } from "../schema/grades.ts";
import type { PoolConstraint, Program, Requirement } from "../schema/program.ts";
import { matches } from "../selector.ts";
import type { UsableCourse } from "./types.ts";

// Decides which requirement each course fills. Greedy fill, then moves/swaps until the
// score stops improving. allocate.test.ts checks it against brute force.

type Pool = Extract<Requirement, { type: "pool" }>;
type OneOf = Extract<Requirement, { type: "oneOf" }>;

// oneOf id -> chosen option index
export type Choice = ReadonlyMap<string, number>;

export interface CourseSlot {
  kind: "course";
  id: string;
  codes: CourseCode[];
  primary: CourseCode;
  minGrade?: LetterGrade | undefined;
}

export interface PoolSlot {
  kind: "pool";
  id: string;
  pool: Pool;
  mustInclude: Array<{ code: CourseCode; minGrade?: LetterGrade | undefined }>;
  catchAll: boolean;
}

export type Slot = CourseSlot | PoolSlot;

export type Assignment = Map<CourseCode, string>;

export interface AllocationContext {
  scale: GradingScale;
  // courses named by a requirement; pools can't take them (electives are "in addition to" the core)
  named?: ReadonlySet<CourseCode> | undefined;
}

export function withNamedCourses(slots: Slot[], ctx: AllocationContext): AllocationContext {
  return { ...ctx, named: new Set(slots.flatMap((s) => (s.kind === "course" ? s.codes : []))) };
}

function oneOfs(reqs: Requirement[]): OneOf[] {
  const out: OneOf[] = [];
  const walk = (r: Requirement) => {
    if (r.type === "allOf") r.items.forEach(walk);
    if (r.type === "oneOf") {
      out.push(r);
      r.options.forEach(walk);
    }
  };
  reqs.forEach(walk);
  return out;
}

// every combination of oneOf options (16 for BCS)
export function allChoices(reqs: Requirement[]): Choice[] {
  let choices: Array<Map<string, number>> = [new Map()];
  for (const o of oneOfs(reqs)) {
    choices = choices.flatMap((c) => o.options.map((_, i) => new Map(c).set(o.id, i)));
  }
  return choices;
}

export function activeSlots(reqs: Requirement[], choice: Choice, patches: Program["designations"][number]["patches"] = []): Slot[] {
  const slots: Slot[] = [];
  const walk = (r: Requirement) => {
    switch (r.type) {
      case "course":
        slots.push({
          kind: "course",
          id: r.id,
          codes: [r.code, ...(r.acceptAlso?.codes ?? [])],
          primary: r.code,
          minGrade: r.minGrade,
        });
        break;
      case "allOf":
        r.items.forEach(walk);
        break;
      case "oneOf":
        walk(r.options[choice.get(r.id) ?? 0]!);
        break;
      case "pool": {
        const patch = (patches ?? []).filter((p) => p.pool === r.id);
        slots.push({
          kind: "pool",
          id: r.id,
          pool: applyPatches(r, patch),
          mustInclude: patch.flatMap((p) => p.mustInclude ?? []),
          catchAll: r.select.type === "anyCourse",
        });
        break;
      }
      case "cgpa":
        break;
    }
  };
  reqs.forEach(walk);
  return slots;
}

function applyPatches(pool: Pool, patches: NonNullable<Program["designations"][number]["patches"]>): Pool {
  if (patches.length === 0) return pool;
  const constraints = new Map((pool.constraints ?? []).map((c) => [c.id, c]));
  for (const p of patches) for (const c of p.constraints ?? []) constraints.set(c.id, c);
  return { ...pool, constraints: [...constraints.values()] };
}

export type Acceptance = "yes" | "approval" | "no";

export function poolAccepts(slot: PoolSlot, c: UsableCourse, ctx: AllocationContext): Acceptance {
  if (ctx.named?.has(c.code)) return "no";
  if (matches(slot.pool.select, c.facts)) return "yes";
  // approvals aren't recorded yet, so these always need review
  return slot.pool.approval?.some((a) => matches(a.select, c.facts)) ? "approval" : "no";
}

export function courseSlotAccepts(slot: CourseSlot, c: UsableCourse, ctx: AllocationContext): boolean {
  if (!slot.codes.includes(c.code)) return false;
  if (!slot.minGrade || c.state !== "completed") return true;
  return meetsGrade(c.attempt, slot.minGrade, ctx.scale) === true;
}

function accepts(slot: Slot, c: UsableCourse, ctx: AllocationContext): boolean {
  return slot.kind === "course" ? courseSlotAccepts(slot, c, ctx) : poolAccepts(slot, c, ctx) === "yes";
}

export interface PoolMeasure {
  courses: number;
  creditHours: number;
  constraints: Array<{ c: PoolConstraint; have: number; need: number; unit: "courses" | "ch" }>;
  mustInclude: Array<{ code: CourseCode; minGrade?: LetterGrade | undefined; met: boolean }>;
  deficit: number;
}

// Roughly "how many more courses does this pool need". One course can close several gaps
// at once, so take the biggest gap instead of summing them; the rest only nudges ties.
export function measurePool(slot: PoolSlot, courses: UsableCourse[], ctx: AllocationContext): PoolMeasure {
  const p = slot.pool;
  const weight = (c: UsableCourse) => (p.sixChCountsAsTwo ? c.weight : 1);
  const count = courses.reduce((n, c) => n + weight(c), 0);
  const ch = courses.reduce((n, c) => n + c.facts.creditHours, 0);
  const gaps = [Math.max(0, (p.minCourses ?? 0) - count), Math.max(0, (p.minCreditHours ?? 0) - ch) / 3];

  const constraints = (p.constraints ?? []).map((c) => {
    const hits = courses.filter((x) => matches(c.select, x.facts));
    const courseHave = hits.reduce((n, x) => n + weight(x), 0);
    const chHave = hits.reduce((n, x) => n + x.facts.creditHours, 0);
    if (c.minCourses) gaps.push(Math.max(0, c.minCourses - courseHave));
    if (c.minCreditHours) gaps.push(Math.max(0, c.minCreditHours - chHave) / 3);
    return c.minCourses
      ? { c, have: courseHave, need: c.minCourses, unit: "courses" as const }
      : { c, have: chHave, need: c.minCreditHours ?? 0, unit: "ch" as const };
  });

  const mustInclude = slot.mustInclude.map((m) => {
    const hit = courses.find((x) => x.code === m.code);
    const met = !!hit && (!m.minGrade || hit.state !== "completed" || meetsGrade(hit.attempt, m.minGrade, ctx.scale) === true);
    if (!met) gaps.push(1);
    return { ...m, met };
  });

  const largest = Math.max(0, ...gaps);
  const deficit = largest + 0.01 * (gaps.reduce((a, b) => a + b, 0) - largest);
  return { courses: count, creditHours: ch, constraints, mustInclude, deficit };
}

// Lower is better. Specific requirements come before free electives: "you still need
// MATH 1003" is worse than "one more course of anything".
export type Score = [
  specificIfPassed: number,
  catchAllIfPassed: number,
  specificNow: number,
  catchAllNow: number,
  unusedCourses: number,
];

export function compareScores(a: Score, b: Score): number {
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    if (Math.abs(d) > 1e-9) return d;
  }
  return 0;
}

export function scoreAssignment(slots: Slot[], usable: UsableCourse[], assignment: Assignment, ctx: AllocationContext): Score {
  const byCode = new Map(usable.map((c) => [c.code, c]));
  const coursesIn = (id: string, onlyCompleted: boolean) =>
    [...assignment]
      .filter(([, s]) => s === id)
      .map(([code]) => byCode.get(code)!)
      .filter((c) => !onlyCompleted || c.state === "completed");

  const score: Score = [0, 0, 0, 0, usable.length - assignment.size];
  for (const slot of slots) {
    const catchAll = slot.kind === "pool" && slot.catchAll;
    const [ifPassed, now] =
      slot.kind === "course"
        ? [coursesIn(slot.id, false).length ? 0 : 1, coursesIn(slot.id, true).length ? 0 : 1]
        : [measurePool(slot, coursesIn(slot.id, false), ctx).deficit, measurePool(slot, coursesIn(slot.id, true), ctx).deficit];
    score[catchAll ? 1 : 0] += ifPassed;
    score[catchAll ? 3 : 2] += now;
  }
  return score;
}

// The allocation in progress, with the lookups every step needs.
class Allocation {
  readonly assignment: Assignment = new Map();
  readonly slots: Slot[];
  readonly usable: UsableCourse[];
  readonly ctx: AllocationContext;
  private readonly byCode: Map<CourseCode, UsableCourse>;

  constructor(slots: Slot[], usable: UsableCourse[], ctx: AllocationContext) {
    this.slots = slots;
    this.usable = usable;
    this.ctx = ctx;
    this.byCode = new Map(usable.map((c) => [c.code, c]));
  }

  course(code: CourseCode): UsableCourse {
    return this.byCode.get(code)!;
  }

  unplaced(): UsableCourse[] {
    return this.usable.filter((c) => !this.assignment.has(c.code));
  }

  coursesIn(slotId: string): UsableCourse[] {
    return [...this.assignment].filter(([, s]) => s === slotId).map(([code]) => this.course(code));
  }

  slot(id: string | undefined): Slot | undefined {
    return this.slots.find((s) => s.id === id);
  }

  score(): Score {
    return scoreAssignment(this.slots, this.usable, this.assignment, this.ctx);
  }

  place(code: CourseCode, slotId: string | undefined) {
    if (slotId === undefined) this.assignment.delete(code);
    else this.assignment.set(code, slotId);
  }
}

const completedFirst = (c: UsableCourse) => (c.state === "completed" ? 0 : 1);

export function allocate(slots: Slot[], usable: UsableCourse[], baseCtx: AllocationContext): { assignment: Assignment; score: Score } {
  const a = new Allocation(slots, usable, withNamedCourses(slots, baseCtx));
  const pools = poolsMostSpecificFirst(a);

  placeNamedCourses(a);
  fillPools(a, pools);
  parkLeftovers(a, pools);
  const score = improveByLocalSearch(a);

  return { assignment: a.assignment, score };
}

// Core and math courses go to the requirement that names them.
// The listed code beats a substitute, and a completed course beats one in progress.
function placeNamedCourses(a: Allocation) {
  for (const slot of a.slots) {
    if (slot.kind !== "course") continue;
    const pick = a
      .unplaced()
      .filter((c) => courseSlotAccepts(slot, c, a.ctx))
      .sort((x, y) => Number(y.code === slot.primary) - Number(x.code === slot.primary) || completedFirst(x) - completedFirst(y))[0];
    if (pick) a.place(pick.code, slot.id);
  }
}

// Pools that accept fewer courses get first pick; free electives go last.
function poolsMostSpecificFirst(a: Allocation): PoolSlot[] {
  const pools = a.slots.filter((s): s is PoolSlot => s.kind === "pool");
  const candidates = (p: PoolSlot) => a.usable.filter((c) => poolAccepts(p, c, a.ctx) === "yes").length;
  return pools.sort((x, y) => Number(x.catchAll) - Number(y.catchAll) || candidates(x) - candidates(y));
}

// Fill each pool until it's satisfied, always taking the course that closes the most of its gap.
function fillPools(a: Allocation, pools: PoolSlot[]) {
  const poolsAccepting = (c: UsableCourse) => pools.filter((p) => poolAccepts(p, c, a.ctx) === "yes").length;

  for (const pool of pools) {
    for (const must of pool.mustInclude) {
      const c = a.usable.find((u) => u.code === must.code);
      if (c && !a.assignment.has(c.code) && poolAccepts(pool, c, a.ctx) === "yes") a.place(c.code, pool.id);
    }

    while (true) {
      const gap = measurePool(pool, a.coursesIn(pool.id), a.ctx).deficit;
      if (gap <= 1e-9) break;

      const best = a
        .unplaced()
        .filter((c) => poolAccepts(pool, c, a.ctx) === "yes")
        .map((c) => ({ c, gain: gap - measurePool(pool, [...a.coursesIn(pool.id), c], a.ctx).deficit }))
        .filter((o) => o.gain > 1e-9)
        .sort(
          (x, y) =>
            y.gain - x.gain ||
            completedFirst(x.c) - completedFirst(y.c) ||
            poolsAccepting(x.c) - poolsAccepting(y.c) ||
            x.c.code.localeCompare(y.c.code),
        )[0];
      if (!best) break;
      a.place(best.c.code, pool.id);
    }
  }
}

// Extra courses still count toward the 40-course total, so they sit in free electives.
function parkLeftovers(a: Allocation, pools: PoolSlot[]) {
  for (const c of a.unplaced()) {
    const accepts = (p: PoolSlot) => poolAccepts(p, c, a.ctx) === "yes";
    const target = pools.find((p) => p.catchAll && accepts(p)) ?? pools.find(accepts);
    if (target) a.place(c.code, target.id);
  }
}

// Greedy filling can paint itself into a corner, so keep moving or swapping pool courses
// while that lowers the score. Named courses stay where they are.
function improveByLocalSearch(a: Allocation): Score {
  const movable = a.usable.map((c) => c.code).filter((code) => a.slot(a.assignment.get(code))?.kind !== "course");
  let score = a.score();

  const keepIfBetter = (undo: () => void): boolean => {
    const s = a.score();
    if (compareScores(s, score) < 0) {
      score = s;
      return true;
    }
    undo();
    return false;
  };

  for (let round = 0; round < 50; round++) {
    let improved = false;

    for (const code of movable) {
      const from = a.assignment.get(code);
      for (const target of a.slots) {
        if (target.kind === "course" || target.id === from || !accepts(target, a.course(code), a.ctx)) continue;
        a.place(code, target.id);
        if (keepIfBetter(() => a.place(code, from))) {
          improved = true;
          break;
        }
      }
    }

    for (let i = 0; i < movable.length; i++) {
      for (let j = i + 1; j < movable.length; j++) {
        const [x, y] = [movable[i]!, movable[j]!];
        const [slotX, slotY] = [a.assignment.get(x), a.assignment.get(y)];
        if (slotX === slotY) continue;
        const fitsX = slotY === undefined || accepts(a.slot(slotY)!, a.course(x), a.ctx);
        const fitsY = slotX === undefined || accepts(a.slot(slotX)!, a.course(y), a.ctx);
        if (!fitsX || !fitsY) continue;

        a.place(x, slotY);
        a.place(y, slotX);
        if (keepIfBetter(() => (a.place(x, slotX), a.place(y, slotY)))) improved = true;
      }
    }

    if (!improved) break;
  }
  return score;
}

import { courseFacts, type CourseIndex } from "../courses.ts";
import type { GradingScale } from "../schema/grades.ts";
import type { Program } from "../schema/program.ts";
import { calendarYearOf, compareTerms, type Term } from "../terms.ts";
import { isInProgress, isLetter, meetsGrade } from "../grades.ts";
import type { Attempt, StudentRecord } from "../record.ts";
import type { NotCounted, UsableCourse } from "./types.ts";

export interface UsableSet {
  usable: UsableCourse[];
  notCounted: NotCounted[];
}

// One entry per course that can count; everything else goes to notCounted with a reason.
export function usableCourses(record: StudentRecord, program: Program, index: CourseIndex, scale: GradingScale, asOf: Term): UsableSet {
  const notCounted: NotCounted[] = [];
  const skip = (a: Attempt, reason: string) => notCounted.push({ code: a.code, term: a.term, result: a.result, reason });

  const byCode = new Map<string, Attempt[]>();
  for (const a of [...record.attempts].sort((x, y) => compareTerms(x.term, y.term))) {
    if (a.notations.includes("X")) {
      skip(a, "marked X (extra): not credited to the program");
      continue;
    }
    byCode.set(a.code, [...(byCode.get(a.code) ?? []), a]);
  }

  const candidates: UsableCourse[] = [];
  for (const [code, attempts] of byCode) {
    const facts = courseFacts(code, index, attempts[0]);
    const notes: string[] = facts.listed ? [] : [`${code} isn't in the current calendar listings; credit hours taken from the transcript`];

    if (program.nonCredit.codes.includes(code)) {
      attempts.forEach((a) => skip(a, `${code} doesn't count toward the ${program.code} degree`));
      continue;
    }
    const restriction = facts.course?.creditRestrictions.find(
      (r) => r.programs.includes(program.code) && !(r.exceptInFirstYear && attempts.some((a) => isFirstYear(record, a.term))),
    );
    if (restriction) {
      attempts.forEach((a) => skip(a, restriction.text));
      continue;
    }

    // best grade wins (a retake can raise it)
    const good = attempts
      .filter((a) => meetsGrade(a, program.minGrade, scale) === true || a.result === "TR")
      .sort((x, y) => points(y, scale) - points(x, scale))[0];
    const running = attempts.find(isInProgress);
    const chosen = good ?? running;
    const state: UsableCourse["state"] = chosen === good ? "completed" : chosen && compareTerms(chosen.term, asOf) > 0 ? "planned" : "in-progress";

    for (const a of attempts) {
      if (a === chosen) continue;
      if (chosen && compareTerms(a.term, chosen.term) < 0) skip(a, `repeated; the ${state === "planned" ? "planned" : chosen.result === "IP" ? "current" : "later"} attempt counts`);
      else if (chosen) skip(a, `repeated; the ${chosen.result} attempt counts`);
      else skip(a, reasonNotCounted(a, program, scale));
    }
    if (!chosen) continue;

    if (chosen.result === "TR") notes.push("transfer credit: no UNB grade on record");
    candidates.push({
      code,
      facts,
      attempt: chosen,
      state,
      weight: facts.creditHours >= 6 ? 2 : 1,
      notes,
    });
  }

  // "credit for only one of": keep whichever was done first
  const exclusionGroups = [
    ...program.creditExclusions.map((e) => e.codes),
    ...candidates.map((c) => [c.code, ...(c.facts.course?.creditExclusions ?? [])]),
  ];
  const dropped = new Set<string>();
  const order = [...candidates].sort(
    (a, b) => rankState(a) - rankState(b) || compareTerms(a.attempt.term, b.attempt.term) || a.code.localeCompare(b.code),
  );
  for (const c of order) {
    if (dropped.has(c.code)) continue;
    for (const group of exclusionGroups) {
      if (!group.includes(c.code)) continue;
      for (const other of candidates) {
        if (other.code === c.code || dropped.has(other.code) || !group.includes(other.code)) continue;
        dropped.add(other.code);
        skip(other.attempt, `credit is given for only one of ${c.code} and ${other.code}; ${c.code} counts`);
      }
    }
  }

  return { usable: candidates.filter((c) => !dropped.has(c.code)), notCounted };
}

// CS 1203's "beyond first year" means the academic year of entry (see calendar-notes.md)
function isFirstYear(record: StudentRecord, term: Term): boolean {
  return calendarYearOf(term) === calendarYearOf(record.program.entry);
}

function points(a: Attempt, scale: GradingScale): number {
  return isLetter(a.result) ? scale.points[a.result]! : -1;
}

function rankState(c: UsableCourse): number {
  return ["completed", "in-progress", "planned"].indexOf(c.state);
}

function reasonNotCounted(a: Attempt, program: Program, scale: GradingScale): string {
  if (a.result === "W") return "withdrawn";
  if (a.result === "CR" || a.result === "AEG")
    return `${a.result} has no letter grade; ${program.code} needs ${program.minGrade} or better, so ask the Faculty whether it counts`;
  if (a.result === "NCR") return "no credit (NCR)";
  if (a.result === "AUD") return "audited: no credit";
  if (isLetter(a.result) && (scale.failingResults as readonly string[]).includes(a.result)) return `failed (${a.result})`;
  if (isLetter(a.result)) return `${a.result} is below the ${program.minGrade} that ${program.code} requires`;
  return `result ${a.result} doesn't earn credit`;
}

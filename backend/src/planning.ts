// The engine applied to a student with the loaded catalog: their audit, whether they can take a
// course in a term, and what to take next. Shared by the student routes and the advisor.
import { courseIndex, gradingScale, programs } from "./catalog.ts";
import {
  checkRequisite,
  neededCourses,
  parseRequisite,
  programForEntry,
  REQUISITE_STATUSES,
  runAudit,
  subjectOf,
  termOn,
  worstRequisite,
  type CourseCode,
  type Requirement,
  type RequisiteStatus,
  type Selector,
  type StudentRecord,
  type Term,
} from "./engine/index.ts";

function selectorSubjects(s: Selector): string[] {
  switch (s.type) {
    case "codes":
      return s.codes.map(subjectOf);
    case "subjects":
      return s.subjects;
    case "all":
    case "any":
      return s.of.flatMap(selectorSubjects);
    default:
      // "not", levels, flags and "any course" don't point at a field
      return [];
  }
}

function requirementSubjects(r: Requirement): string[] {
  switch (r.type) {
    case "course":
      return [subjectOf(r.code)];
    case "allOf":
      return r.items.flatMap(requirementSubjects);
    case "oneOf":
      return r.options.flatMap(requirementSubjects);
    case "pool":
      return selectorSubjects(r.select);
    case "cgpa":
      return [];
  }
}

// The subjects a student's program requirements name (CS, MATH, STAT, ... for BCS): their field,
// for ranking course search. Free-elective pools take any course, so they don't narrow it.
export function programSubjects(record: StudentRecord): Set<string> {
  const { program } = programForEntry(programs, record.program);
  return new Set([...program.requirements, ...program.designations.flatMap((d) => d.requirements)].flatMap(requirementSubjects));
}

export function auditOf(record: StudentRecord) {
  return runAudit(record, { programs, index: courseIndex, scale: gradingScale, asOf: termOn(new Date()) });
}

// A listed course's prerequisites and corequisites checked for a term; status is the worse of
// the two. The calendar's text is parsed; parts it can't read come back as "review".
export function eligibility(code: CourseCode, record: StudentRecord, term: Term) {
  const course = courseIndex.get(code)!;
  const ctx = { attempts: record.attempts, term, program: record.program.code, index: courseIndex, scale: gradingScale };
  const prerequisite = course.prereqText ? parseRequisite(course.prereqText) : null;
  const corequisite = course.coreqText ? parseRequisite(course.coreqText) : null;
  const prereqStatus: RequisiteStatus = prerequisite ? checkRequisite(prerequisite, ctx) : "met";
  const coreqStatus: RequisiteStatus = corequisite ? checkRequisite(corequisite, { ...ctx, alongside: true }) : "met";
  return {
    code,
    title: course.title,
    prereqText: course.prereqText,
    coreqText: course.coreqText,
    prerequisite,
    corequisite,
    status: worstRequisite([prereqStatus, coreqStatus]),
  };
}

// Required courses still missing from the audit that the student could take in the term:
// prerequisites met first, then pending on current courses, then ones needing review.
export function suggestions(record: StudentRecord, term: Term) {
  return neededCourses(auditOf(record))
    .filter((code) => courseIndex.has(code))
    .map((code) => eligibility(code, record, term))
    .filter((c) => c.status !== "missing")
    .sort((a, b) => REQUISITE_STATUSES.indexOf(a.status) - REQUISITE_STATUSES.indexOf(b.status) || a.code.localeCompare(b.code));
}

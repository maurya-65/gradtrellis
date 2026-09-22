import type { CourseCode } from "../schema/common.ts";
import type { AuditResult, RequirementResult } from "./types.ts";

// Named courses the audit still counts as missing, in the program and pursued designations.
// Pools (electives) are left out: any number of courses could fill them.
export function neededCourses(audit: AuditResult): CourseCode[] {
  const needed = new Set<CourseCode>();
  const visit = (r: RequirementResult) => {
    // a course requirement's title is its code
    if (r.kind === "course" && r.status === "incomplete") needed.add(r.title);
    r.children?.forEach(visit);
  };
  [...audit.requirements, ...audit.designations.flatMap((d) => d.requirements)].forEach(visit);
  return [...needed];
}

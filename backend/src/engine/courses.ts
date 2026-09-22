import { levelOf, subjectOf, type CourseCode } from "./schema/common.ts";
import type { Course } from "./schema/course.ts";
import type { Attempt } from "./record.ts";

export type CourseIndex = ReadonlyMap<CourseCode, Course>;

// From the catalog when listed, otherwise from the transcript (listed: false).
export interface CourseFacts {
  code: CourseCode;
  subject: string;
  level: number;
  creditHours: number;
  flags: Course["flags"];
  listed: boolean;
  course?: Course | undefined;
}

export function courseFacts(code: CourseCode, index: CourseIndex, attempt?: Attempt): CourseFacts {
  const course = index.get(code);
  if (course) {
    return {
      code,
      subject: course.subject,
      level: course.level,
      // variable-credit courses
      creditHours: attempt?.creditHours ?? course.creditHours,
      flags: course.flags,
      listed: true,
      course,
    };
  }
  return {
    code,
    subject: subjectOf(code),
    level: levelOf(code),
    creditHours: attempt?.creditHours ?? 3,
    flags: { programming: false, writing: false, experiential: false },
    listed: false,
  };
}

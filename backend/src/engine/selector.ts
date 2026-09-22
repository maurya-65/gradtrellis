import type { Selector } from "./schema/program.ts";
import type { CourseFacts } from "./courses.ts";

export function matches(selector: Selector, c: CourseFacts): boolean {
  switch (selector.type) {
    case "codes":
      return selector.codes.includes(c.code);
    case "subjects":
      return selector.subjects.includes(c.subject);
    case "level":
      return (selector.min === undefined || c.level >= selector.min) && (selector.max === undefined || c.level <= selector.max);
    case "flag":
      return c.flags[selector.flag];
    case "minCreditHours":
      return c.creditHours >= selector.min;
    case "anyCourse":
      return true;
    case "all":
      return selector.of.every((s) => matches(s, c));
    case "any":
      return selector.of.some((s) => matches(s, c));
    case "not":
      return !matches(selector.of, c);
  }
}

import { describe, expect, it } from "vitest";
import { parseTranscript } from "./parse.ts";

// Laid out like pdf.ts reads the myUNB unofficial transcript. Synthetic: no real student.
const TRANSCRIPT = [
  ["UNOFFICIAL TRANSCRIPT"],
  ["1234567", "Student, Test"],
  ["2024/FA", "BCS", "Fredericton"],
  ["GRADE", "HRS", "POINTS", "TRANSFERS"],
  ["CS*1073", "INTR COMP PROG I (IN JAVA)", "C", "4.00", "8.00"],
  ["CS*1303", "DISCRETE STRUCTURES", "W", "4.00"],
  ["MATH*1003", "CALCULUS I: DIFFERENTIAL CALC", "B−", "3.00", "8.10"],
  ["Program Credit Hours: Attempted", "7.00", "Passed", "7.00", "Cumulative GPA... 2.4"],
  ["2025/WI", "BCS", "Fredericton"],
  ["CS*1073", "INTR COMP PROG I (IN JAVA)", "A-", "4.00", "14.80"],
  ["ENGL*1103", "FUND'LS OF CLEAR WRITING", "CR", "3.00"],
  ["In good academic standing"],
  ["UNOFFICIAL TRANSCRIPT", "(Continued on page 2)"],
  ["2025/SM", "BCS", "Fredericton"],
  ["CS*1083", "INTRO COMP PROG II (IN JAVA)", "4.00"],
  ["CS*9999", "SPECIAL TOPICS", "Q", "3.00"],
  ["Awards Granted:"],
];

describe("parseTranscript", () => {
  const { attempts, unreadable } = parseTranscript(TRANSCRIPT);

  it("reads every course line under its term", () => {
    expect(attempts.map((a) => `${a.term.season} ${a.term.year} ${a.code} ${a.result}`)).toEqual([
      "Fall 2024 CS 1073 C",
      "Fall 2024 CS 1303 W",
      "Fall 2024 MATH 1003 B-",
      "Winter 2025 CS 1073 A-",
      "Winter 2025 ENGL 1103 CR",
      "Summer 2025 CS 1083 IP",
    ]);
  });

  it("keeps the transcript's credit hours and title", () => {
    expect(attempts[0]).toMatchObject({ creditHours: 4, title: "INTR COMP PROG I (IN JAVA)" });
  });

  it("treats a course with no grade yet as in progress", () => {
    expect(attempts.at(-1)).toMatchObject({ code: "CS 1083", result: "IP", creditHours: 4 });
  });

  it("reports course lines it can't read instead of dropping them", () => {
    expect(unreadable).toEqual(["CS*9999  SPECIAL TOPICS  Q  3.00"]);
  });

  it("needs a term heading before a course", () => {
    const result = parseTranscript([["CS*1073", "INTR COMP PROG I", "A", "4.00"]]);
    expect(result.attempts).toEqual([]);
    expect(result.unreadable).toHaveLength(1);
  });
});

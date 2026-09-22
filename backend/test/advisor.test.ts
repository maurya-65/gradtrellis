import { describe, expect, it } from "vitest";
import { answer } from "../src/advisor/answer.ts";
import { understand } from "../src/advisor/understand.ts";
import { att, F24, record, W25 } from "./engine/helpers.ts";

// a day in Fall 2026, so "next term" is Winter 2027
const NOW = new Date(2026, 8, 22);
const SUBJECTS = new Set(["CS", "MATH", "STAT"]);
const read = (question: string) => understand(question, SUBJECTS, NOW);

describe("understand", () => {
  it("finds course codes however they're typed, once each", () => {
    expect(read("is cs1073 like CS 1073 or cs-1073?").courses).toEqual(["CS 1073"]);
    expect(read("can I take MATH 1003 and cs 2043").courses).toEqual(["MATH 1003", "CS 2043"]);
    // not subjects
    expect(read("I started in fall 2026, year 2025 was rough").courses).toEqual([]);
  });

  it("reads the term asked about", () => {
    expect(read("next term").term).toEqual({ season: "Winter", year: 2027 });
    expect(read("this semester").term).toEqual({ season: "Fall", year: 2026 });
    expect(read("in the fall").term).toEqual({ season: "Fall", year: 2026 });
    expect(read("next fall").term).toEqual({ season: "Fall", year: 2027 });
    expect(read("summer").term).toEqual({ season: "Summer", year: 2027 });
    expect(read("winter 2028").term).toEqual({ season: "Winter", year: 2028 });
    expect(read("how am I doing").term).toBeNull();
  });

  it("tells the kinds of question apart", () => {
    const intents = {
      "Can I take cs3383 next term?": "eligibility",
      "what are the prereqs for CS 2263": "eligibility",
      "tell me about MATH 1003": "course-info",
      "What should I take in the winter?": "next-term",
      "any courses you'd recommend?": "next-term",
      "how many courses do I have left": "progress",
      "am I on track to graduate?": "progress",
      "what's my GPA": "gpa",
      "hey": "greeting",
      "what can you do?": "greeting",
      "write my essay for ENGL class": "unknown",
    };
    for (const [question, intent] of Object.entries(intents)) expect(read(question).intent, question).toBe(intent);
  });
});

describe("answer", () => {
  const student = record([att("CS 1073", F24, "A"), att("CS 1083", W25, "B")]);
  const say = (question: string) => answer(understand(question, SUBJECTS, NOW), student, NOW);

  it("says whether a course can be taken, and why not", () => {
    expect(say("can I take CS 2043 next term?")).toMatch(/^Yes, you can take CS 2043 \(.+\) in Winter 2027\.$/);
    expect(say("can I take cs1073?")).toBe("You've already passed CS 1073.");
    expect(say("can I take CS 3383?")).toBe("Not yet for Winter 2027. CS 3383 needs: CS 2333, CS 2383 and (STAT 2593 or STAT 3083).");
    expect(say("can I take CS 9999?")).toBe("I couldn't find CS 9999 in the 2026-2027 calendar.");
  });

  it("describes a course from the catalog", () => {
    const about = say("what is CS 1073 about?");
    expect(about).toMatch(/^CS 1073 .+ \(\d ch\)\. /);
    expect(about).toContain("Prerequisites: none.");
  });

  it("summarises progress, CGPA and what's open next term", () => {
    expect(say("what do I have left?")).toMatch(/^You've finished 2 of \d+ courses \(\d+ of \d+ credit hours\)\.\nStill to go:\n- /);
    expect(say("my gpa?")).toMatch(/^Your CGPA is \d\.\d\.$/);
    const next = say("what should I take next term?");
    expect(next.split("\n")[0]).toBe("For Winter 2027, these required courses are open to you:");
    expect(next).toMatch(/^- CS 2043 /m);
    expect(next).not.toMatch(/CS 3383/);
  });

  it("says what it can do when it doesn't know", () => {
    expect(say("write my essay")).toMatch(/^I can't answer that one yet\. I can tell you what's left in your degree/);
  });
});

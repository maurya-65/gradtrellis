import { beforeAll, describe, expect, it, vi } from "vitest";
import { answer, ask } from "../src/advisor/answer.ts";
import { expandShorthand, speller } from "../src/advisor/language.ts";
import { understand } from "../src/advisor/understand.ts";
import { att, F24, record, W25 } from "./engine/helpers.ts";

// a day in Fall 2026, so "next term" is Winter 2027
const NOW = new Date(2026, 8, 22);
const SUBJECTS = new Set(["CS", "MATH", "STAT"]);
const read = (question: string) => understand(question, { subjects: SUBJECTS, now: NOW });

// the local ranking only, even with model keys in .env; the model chain has its own tests
beforeAll(() => {
  for (const key of ["GROQ_API_KEY", "MISTRAL_API_KEY", "GEMINI_API_KEY"]) vi.stubEnv(key, "");
});

describe("language", () => {
  const fix = speller(["Introduction to Machine Learning", "Data Structures and Algorithms", "should recommend prerequisites"]);

  it("fixes misspelled words against the vocabulary", () => {
    expect(fix("machine lerning")).toBe("machine learning");
    expect(fix("algoritms")).toBe("algorithms");
    expect(fix("shoud i take this")).toBe("should i take this");
    expect(fix("reccomend prerequisits")).toBe("recommend prerequisites");
  });

  it("breaks ties toward a dropped letter, then preferred words", () => {
    const tied = speller(["real real real ready"], ["ready", "really"]);
    // one edit from all three; "really" is "realy" plus the missing letter
    expect(tied("realy")).toBe("really");
    expect(speller(["dates dates dates"], ["dated"])("datex")).toBe("dated");
  });

  it("leaves short words, and words too far from anything, alone", () => {
    expect(fix("teh cat")).toBe("teh cat");
    expect(fix("zebra")).toBe("zebra");
  });

  it("spells out shorthand", () => {
    expect(expandShorthand("i like ml and web dev")).toBe("i like machine learning and web development");
    expect(expandShorthand("html is not ml")).toBe("html is not machine learning");
  });
});

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
      "wht to do to get a specialisation in cyber sec ?": "designation",
      "how do I get honours": "designation",
      "what gpa do I need for first class honors": "designation",
      "can I take CS 4411 for the cybersecurity specialization?": "eligibility",
      "i'm really into cybersecurity": "explore",
      "any courses about databases?": "explore",
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

  it("notes a designation mentioned in a topic question without taking it as one", () => {
    expect(read("what do in cyber security ?")).toMatchObject({ intent: "unknown", designation: "cybersecurity" });
  });

  it("fixes spelling before reading the question", () => {
    const fixSpelling = speller(["should recommend"]);
    expect(understand("what shoud i take, any reccomendations?", { subjects: SUBJECTS, fixSpelling, now: NOW }).intent).toBe("next-term");
  });
});

describe("answer", () => {
  const student = record([att("CS 1073", F24, "A"), att("CS 1083", W25, "B")]);
  const say = (question: string) => answer(read(question), student, NOW);

  it("says whether a course can be taken, and why not", async () => {
    expect(await say("can I take CS 2043 next term?")).toMatch(/^Yes, you can take CS 2043 \(.+\) in Winter 2027\.$/);
    expect(await say("can I take cs1073?")).toBe("You've already passed CS 1073.");
    expect(await say("can I take CS 3383?")).toBe("Not yet for Winter 2027. CS 3383 needs: CS 2333, CS 2383 and (STAT 2593 or STAT 3083).");
    expect(await say("can I take CS 9999?")).toBe("I couldn't find CS 9999 in the 2026-2027 calendar.");
  });

  it("describes a course from the catalog", async () => {
    const about = await say("what is CS 1073 about?");
    expect(about).toMatch(/^CS 1073 .+ \(\d ch\)\. /);
    expect(about).toContain("Prerequisites: none.");
  });

  it("summarises progress, CGPA and what's open next term", async () => {
    expect(await say("what do I have left?")).toMatch(/^You've finished 2 of \d+ courses \(\d+ of \d+ credit hours\)\.\nStill to go:\n- /);
    expect(await say("my gpa?")).toMatch(/^Your CGPA is \d\.\d\.$/);
    const next = await say("what should I take next term?");
    expect(next.split("\n")[0]).toBe("For Winter 2027, these required courses are open to you:");
    expect(next).toMatch(/^- CS 2043 /m);
    expect(next).not.toMatch(/CS 3383/);
  });

  it("says what a designation takes, even one the student hasn't added", async () => {
    const cyber = await say("wht to do to get a specialisation in cyber sec ?");
    // the calendar: CS 2413, 4355, 4411, 4417, 4865 and one of 4413, 4415 or 4419, each C or better
    expect(cyber.split("\n")[1]).toBe(
      "- Cybersecurity courses (each C or better): CS 2413, CS 4355, CS 4411, CS 4417, CS 4865 remaining; one of CS 4413, CS 4415 or CS 4419",
    );
    expect(cyber.split("\n").at(-1)).toBe("You haven't added it to your degree yet; you can in your profile.");

    const honours = await say("how do I get honours?");
    expect(honours).toMatch(/^The Honours in Computer Science needs:\n/);
    // an A and a B so far
    expect(honours).toContain("- Cumulative GPA of 3.0 or above: done");
  });

  // from here on the local embedding model runs (downloaded on first use)
  it("finds courses on a topic, through typos and shorthand", { timeout: 120_000 }, async () => {
    const ml = await ask("i realy like machine lerning, what fits?", student, NOW);
    expect(ml.intent).toBe("explore");
    expect(ml.answer.split("\n")[1]).toMatch(/^- CS 3735 Introduction to Machine Learning \(/);

    const web = (await ask("any corses about web dev?", student, NOW)).answer;
    expect(web).toContain("- CS 3103 Programming on the Web");
    // undergraduate courses only
    expect(web).not.toMatch(/^- [A-Z]+ [5-9]\d{3}/m);
  });

  it("points topic questions about cybersecurity to the specialization", { timeout: 120_000 }, async () => {
    const reply = (await ask("what do in cyber security ?", student, NOW)).answer;
    expect(reply).toMatch(/^These courses are closest to what you asked about:\n- /);
    // the student's own field first: no PHIL 3211 Cyber Ethics ahead of the CS security courses
    expect(reply).not.toContain("PHIL");
    expect(reply.split("\n").at(-1)).toMatch(/^There's also a Specialization in Cybersecurity\./);
  });

  it("reads a bare topic as one, but not an off-topic request", { timeout: 120_000 }, async () => {
    expect((await ask("databses", student, NOW)).answer).toContain("- CS 1543 Introduction to Databases");
    expect((await ask("write my essay for me", student, NOW)).answer).toMatch(/^I can't answer that one yet\. I can tell you what's left in your degree/);
  });
});

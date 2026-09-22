import { describe, expect, it } from "vitest";
import { emailMatches, fullName, nameMatches } from "../src/names.ts";

describe("fullName", () => {
  it("turns the transcript's order around", () => {
    expect(fullName("Tremblay, Anne Marie")).toBe("Anne Marie Tremblay");
    expect(fullName("Tremblay")).toBe("Tremblay");
  });
});

describe("nameMatches", () => {
  const printed = "Tremblay, Anne Marie";

  it("accepts the full name, a shorter one, and any order", () => {
    expect(nameMatches("Anne Marie Tremblay", printed)).toBe(true);
    expect(nameMatches("Anne Tremblay", printed)).toBe(true);
    expect(nameMatches("Marie Tremblay", printed)).toBe(true);
    expect(nameMatches("Tremblay Anne", printed)).toBe(true);
    expect(nameMatches("  anne   TREMBLAY ", printed)).toBe(true);
  });

  it("forgives accents, punctuation and a small typo", () => {
    expect(nameMatches("Zoe O'Neil-Leblanc", "O'Neil-Leblanc, Zoë")).toBe(true);
    expect(nameMatches("Zoe ONeil Leblanc", "O'Neil-Leblanc, Zoë")).toBe(true);
    expect(nameMatches("Anne Tremblya", printed)).toBe(true);
  });

  it("accepts a multi-word surname typed as one word", () => {
    expect(nameMatches("Pieter Vanderberg", "Van Der Berg, Pieter")).toBe(true);
    expect(nameMatches("Pieter Van Der Berg", "Van Der Berg, Pieter")).toBe(true);
  });

  it("refuses someone else's name, a missing surname or given name, and extra names", () => {
    expect(nameMatches("John Smith", printed)).toBe(false);
    expect(nameMatches("Anne Marie", printed)).toBe(false);
    expect(nameMatches("Tremblay", printed)).toBe(false);
    expect(nameMatches("Anne Gagnon Tremblay", printed)).toBe(false);
  });
});

describe("emailMatches", () => {
  it("reads givennames.surname emails", () => {
    expect(emailMatches("annemarie.tremblay@unb.ca", "Tremblay, Anne Marie")).toBe(true);
    expect(emailMatches("anne.tremblay2@unb.ca", "Tremblay, Anne Marie")).toBe(true);
    expect(emailMatches("a.tremblay@unb.ca", "Tremblay, Anne Marie")).toBe(true);
    expect(emailMatches("zoe.oneilleblanc@unb.ca", "O'Neil-Leblanc, Zoë")).toBe(true);
    expect(emailMatches("zoe.leblanc@unb.ca", "O'Neil-Leblanc, Zoë")).toBe(true);
  });

  it("catches a transcript with someone else's name", () => {
    expect(emailMatches("annemarie.tremblay@unb.ca", "Smith, John")).toBe(false);
    expect(emailMatches("john.tremblay@unb.ca", "Tremblay, Anne Marie")).toBe(false);
  });

  it("can't judge emails in other shapes, so lets them through", () => {
    expect(emailMatches("atremb1@unb.ca", "Smith, John")).toBe(true);
  });
});

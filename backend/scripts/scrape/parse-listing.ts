import * as cheerio from "cheerio";
import { levelOf, normalizeCourseCode, subjectOf, type CreditRestriction, type SourceRef } from "../../src/engine/index.ts";

export interface RawCourse {
  code: string;
  subject: string;
  level: number;
  title: string;
  creditHours: number;
  creditText: string;
  flags: { programming: boolean; writing: boolean; experiential: boolean };
  description: string;
  prereqText: string | null;
  coreqText: string | null;
  creditRestrictions: CreditRestriction[];
  creditExclusions: string[];
  warnings: string[];
  source: SourceRef;
}

const CODE_IN_TEXT = /\b([A-Z]{2,5})\s?(\d{4})\b/g;

function clean(text: string): string {
  return text
    .replace(/ /g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function spaceCourseCodes(text: string): string {
  return text.replace(CODE_IN_TEXT, "$1 $2");
}

function codesIn(text: string): string[] {
  return [...spaceCourseCodes(text).matchAll(CODE_IN_TEXT)].map((m) => `${m[1]} ${m[2]}`);
}

const PREREQ_LABEL = /^pre-?requisites?\s*:?\s*/i;
const COREQ_LABEL = /co-?requisites?\s*:\s*/i;

// Some listings put the coreq inside the prereq element ("Prerequisite: Co-requisite: CS 2263.").
function splitRequisites(
  prereqRaw: string,
  coreqRaw: string,
  warnings: string[],
): { prereqText: string | null; coreqText: string | null } {
  let pre = prereqRaw.replace(PREREQ_LABEL, "").trim();
  let co = coreqRaw.replace(/^co-?requisites?\s*:?\s*/i, "").trim();

  const idx = pre.search(COREQ_LABEL);
  // "Pre- or co-requisite:" is one requisite, don't split it
  if (idx >= 0 && !/pre-? or co-?requisite/i.test(pre)) {
    const moved = pre.slice(idx).replace(COREQ_LABEL, "").trim();
    pre = pre.slice(0, idx).trim().replace(/[.;,]\s*$/, "");
    if (co && moved && co !== moved) warnings.push(`corequisite listed twice: "${moved}" vs "${co}"`);
    co = co || moved;
  }
  const norm = (s: string) => (s.length ? spaceCourseCodes(s) : null);
  return { prereqText: norm(pre), coreqText: norm(co) };
}

const PROGRAM_TOKEN = /\b(BCS|BScSwE|BScEE|BScCE|BScE|BSc|BA|BBA|BN|BEd|BPhil)\b/g;

function parseCreditRestrictions(description: string): CreditRestriction[] {
  const out: CreditRestriction[] = [];
  const re = /may not be taken for credit by ([^.]+)\./gi;
  for (const m of description.matchAll(re)) {
    for (const piece of m[1]!.split(/\s+or\s+by\s+/i)) {
      const programs = [...piece.matchAll(PROGRAM_TOKEN)].map((p) => p[1]!);
      if (programs.length === 0) continue;
      out.push({
        programs,
        exceptInFirstYear: /beyond (their )?first year/i.test(piece),
        text: clean(m[0]),
      });
    }
  }
  return out;
}

function parseCreditExclusions(description: string, self: string): string[] {
  const patterns = [
    /credit (?:cannot|can not|will not|may not) be (?:counted|given|granted|received|obtained|earned) for both ([^.]+)/gi,
    /(?:cannot|can not|may not) receive credit for both ([^.]+)/gi,
    /credit (?:is|will|may|can) (?:only )?(?:be )?(?:given|granted|received|counted|obtained|earned) (?:for|in) (?:only )?one of ([^.]+)/gi,
    /antirequisites?\s*:\s*([^.]+)/gi,
  ];
  const found = new Set<string>();
  for (const re of patterns) {
    for (const m of description.matchAll(re)) {
      for (const c of codesIn(m[1]!)) if (c !== self) found.add(c);
    }
  }
  return [...found].sort();
}

function parseCredit(creditText: string): { hours: number | null; programming: boolean; writing: boolean; experiential: boolean } {
  // Most departments print "3 ch"; French prints "3 cr".
  const m = /^(\d+(?:\.\d+)?)\s*(?:ch|cr)\b/i.exec(creditText);
  return {
    hours: m ? Number(m[1]) : null,
    programming: /\(P\)/.test(creditText),
    writing: /\(W\)/.test(creditText),
    experiential: /\(EL\)/.test(creditText),
  };
}

export function parseListingPage(html: string, url: string, document: string): RawCourse[] {
  const $ = cheerio.load(html);
  const courses: RawCourse[] = [];

  $("table").each((_, table) => {
    const $t = $(table);
    const codeRaw = clean($t.find('th[abbr="Course Code"]').first().text());
    if (!codeRaw) return;

    const warnings: string[] = [];
    const code = normalizeCourseCode(codeRaw);
    if (!code) return;

    const title = clean($t.find('th[abbr="Course Dscription"], th[abbr="Course Description"]').first().text());
    const creditText = clean($t.find('th[abbr="Course Credit"]').first().text());
    const credit = parseCredit(creditText);
    if (credit.hours === null) warnings.push(`could not read credit hours from "${creditText}"`);

    const description = spaceCourseCodes(clean($t.find("course_description").text()));
    const { prereqText, coreqText } = splitRequisites(
      clean($t.find("course_prereq").text()),
      clean($t.find("course_coreq").text()),
      warnings,
    );

    courses.push({
      code,
      subject: subjectOf(code),
      level: levelOf(code),
      title,
      creditHours: credit.hours ?? 0,
      creditText,
      flags: { programming: credit.programming, writing: credit.writing, experiential: credit.experiential },
      description,
      prereqText,
      coreqText,
      creditRestrictions: parseCreditRestrictions(description),
      creditExclusions: parseCreditExclusions([description, prereqText, coreqText].filter(Boolean).join(" "), code),
      warnings,
      source: { document, url, section: `${code} ${title}` },
    });
  });

  return courses;
}

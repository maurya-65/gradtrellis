// Scrapes UNB Fredericton course listings into data/courses/unb-fredericton/<year>.json.
//
//   npm run scrape                        everything (cached pages are reused)
//   npm run scrape -- --refresh           re-download
//   npm run scrape -- --only mathematics  re-scrape some subjects, merge into the snapshot
import * as cheerio from "cheerio";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Course, CourseSnapshot } from "../../src/engine/index.ts";
import { politeFetch } from "./fetch.ts";
import { parseListingPage } from "./parse-listing.ts";

const BASE = "https://www.unb.ca/academics/calendar/undergraduate/current/";
const COURSES_INDEX = `${BASE}frederictoncourses/index.html`;

const cacheDir = join(import.meta.dirname, ".cache");
const dataDir = join(import.meta.dirname, "..", "..", "data");

const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const onlyArg = args[args.indexOf("--only") + 1];
const only = args.includes("--only") && onlyArg ? new Set(onlyArg.split(",")) : null;

async function detectCalendarYear(): Promise<string> {
  const html = await politeFetch(`${BASE}index.html`, { cacheDir, refresh });
  const years = [...html.matchAll(/(20\d{2})-(20\d{2})/g)]
    .filter((m) => Number(m[2]) === Number(m[1]) + 1)
    .map((m) => m[0]);
  const latest = years.sort().at(-1);
  if (!latest) throw new Error("could not detect the calendar year from the calendar index page");
  return latest;
}

async function subjectPages(): Promise<Array<{ slug: string; url: string }>> {
  const html = await politeFetch(COURSES_INDEX, { cacheDir, refresh });
  const $ = cheerio.load(html);
  const seen = new Map<string, string>();
  $('a[href$="/index.html"]').each((_, a) => {
    const href = $(a).attr("href")!;
    const m = /^([a-z0-9-]+)\/index\.html$/.exec(href);
    if (m) seen.set(m[1]!, new URL(href, COURSES_INDEX).toString());
  });
  return [...seen].map(([slug, url]) => ({ slug, url }));
}

async function main() {
  const calendarYear = await detectCalendarYear();
  const document = `UNB Undergraduate Calendar ${calendarYear} (Fredericton courses)`;
  const pages = (await subjectPages()).filter((p) => !only || only.has(p.slug));
  console.log(`calendar ${calendarYear}: ${pages.length} subject pages`);

  const byCode = new Map<string, Course>();
  const subjects = new Set<string>();
  let failed = 0;
  let warned = 0;

  for (const { slug, url } of pages) {
    try {
      const html = await politeFetch(url, { cacheDir, refresh });
      const raws = parseListingPage(html, url, document);
      for (const raw of raws) {
        subjects.add(raw.subject);
        // cross-listed courses show up twice; keep the first
        const existing = byCode.get(raw.code);
        if (existing) {
          if (existing.prereqText !== raw.prereqText) raw.warnings.push(`listed differently on ${url}`);
        } else {
          // parse drops the scraper-only warnings field
          byCode.set(raw.code, Course.parse(raw));
        }
        for (const w of raw.warnings) console.warn(`    ${raw.code}: ${w}`);
        if (raw.warnings.length) warned++;
      }
      console.log(`  ${slug.padEnd(36)} ${raws.length}`);
    } catch (err) {
      failed++;
      console.error(`  ${slug}: ${(err as Error).message}`);
    }
  }

  const out = join(dataDir, "courses", "unb-fredericton", `${calendarYear}.json`);

  // --only: keep the subjects we didn't touch
  if (only && existsSync(out)) {
    const previous = CourseSnapshot.parse(JSON.parse(await readFile(out, "utf8")));
    for (const c of previous.courses) {
      if (!subjects.has(c.subject) && !byCode.has(c.code)) byCode.set(c.code, c);
    }
    for (const s of previous.subjects) subjects.add(s);
  }

  const courses = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  const snapshot = CourseSnapshot.parse({
    institution: "unb",
    campus: "fredericton",
    calendarYear,
    retrievedAt: new Date().toISOString(),
    subjects: [...subjects].sort(),
    courses,
  });

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  console.log(`\n${courses.length} courses, ${warned} with warnings, ${failed} pages failed -> ${out}`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

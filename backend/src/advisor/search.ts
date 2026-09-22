// Finds undergraduate courses by meaning ("I like machine learning"), not just by code or title
// words. 5000-level and up are graduate courses, so they're left out.
import { join } from "node:path";
import { courseIndex, dataDir, snapshot } from "../catalog.ts";
import type { Course } from "../engine/index.ts";
import { embed, loadCourseVectors, type CourseVectors } from "./embeddings.ts";

export const courseVectorsFile = join(dataDir, "embeddings", "unb-fredericton", `${snapshot.calendarYear}.json`);

let courseVectors: CourseVectors | null = null;

const STOPWORDS = new Set(
  "the and for with about into like love enjoy what which should could would take taking want courses course class classes any anything interested learn learning more some that this there their them from have does".split(" "),
);

export interface Match {
  course: Course;
  // how close in meaning (cosine, about 0-1); 0.5 and up is a close match
  similarity: number;
  // similarity plus the lifts below, for ranking
  score: number;
}

function keywords(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z]{3,}/g) ?? [])].filter((w) => !STOPWORDS.has(w));
}

// Exact terms ("cryptography") should win over looser matches, so a course whose title or
// description uses the question's words gets a small lift.
function wordBonus(terms: string[], course: Course): number {
  if (terms.length === 0) return 0;
  const title = course.title.toLowerCase();
  const description = course.description.toLowerCase();
  const inTitle = terms.filter((t) => title.includes(t)).length;
  const inDescription = terms.filter((t) => description.includes(t)).length;
  return (0.15 * inTitle + 0.05 * inDescription) / terms.length;
}

// a lift for courses in the student's own field, so "cybersecurity" lists CS courses before a
// related course elsewhere; a clearly better match in another subject still wins
const FIELD_BONUS = 0.1;

export async function coursesLike(text: string, { limit = 5, field }: { limit?: number; field?: ReadonlySet<string> } = {}): Promise<Match[]> {
  courseVectors ??= loadCourseVectors(courseVectorsFile);
  if (!courseVectors) throw new Error(`${courseVectorsFile} is missing; run npm run embed`);
  const { codes, dims, vectors } = courseVectors;

  const [query] = await embed([text]);
  const terms = keywords(text);
  const matches: Match[] = [];
  codes.forEach((code, i) => {
    const course = courseIndex.get(code);
    if (!course || course.level > 4) return;
    let dot = 0;
    for (let j = 0; j < dims; j++) dot += vectors[i * dims + j]! * query![j]!;
    const similarity = dot / 127;
    matches.push({ course, similarity, score: similarity + wordBonus(terms, course) + (field?.has(course.subject) ? FIELD_BONUS : 0) });
  });
  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

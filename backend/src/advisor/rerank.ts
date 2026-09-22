// Local search finds candidates by meaning; a model then picks the ones that really fit the
// question and says why in a few words. The model only chooses among the candidates: codes it
// returns that weren't offered are dropped, so it can't invent a course. It sees the question and
// public catalog text, never the student's record.
import { z } from "zod";
import { normalizeCourseCode } from "../engine/index.ts";
import { complete } from "./models.ts";
import type { Match } from "./search.ts";

export interface Pick {
  match: Match;
  // a short reason it fits, in the model's words
  why: string;
}

const Reply = z.object({ picks: z.array(z.object({ code: z.string(), why: z.string() })) });

const MAX_WHY = 110;

const system = (limit: number) =>
  `You help university students find courses. From the candidate courses given, pick up to ${limit} that best fit ` +
  `the student's question, best first. Use only codes from the list, and leave out candidates that don't fit. ` +
  `For each, give a reason under 15 words based only on its description. ` +
  `Reply with JSON only, like {"picks":[{"code":"CS 1234","why":"..."}]}`;

// Numbers that look like a student number and email addresses stay on our server.
export function scrub(question: string): string {
  return question.replace(/\S+@\S+/g, "[email]").replace(/\d{6,}/g, "[number]");
}

function firstSentence(text: string): string {
  return text.split(/(?<=\.)\s/)[0]!;
}

// one line, and short; cut at a word
function tidyWhy(why: string): string {
  const line = why.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  return line.length <= MAX_WHY ? line : `${line.slice(0, MAX_WHY).replace(/\s+\S*$/, "")}…`;
}

// The picks, best first, or null if no model answered usefully.
export async function rerank(question: string, candidates: Match[], limit: number, ask = complete): Promise<Pick[] | null> {
  const list = candidates.map((m) => `${m.course.code} | ${m.course.title} | ${firstSentence(m.course.description)}`).join("\n");
  const reply = await ask(system(limit), `Question: ${scrub(question)}\n\nCandidates:\n${list}`);
  if (!reply) return null;

  let parsed: z.infer<typeof Reply>;
  try {
    // models sometimes wrap the JSON in prose or a code fence
    parsed = Reply.parse(JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] ?? ""));
  } catch {
    return null;
  }

  const offered = new Map(candidates.map((m) => [m.course.code, m]));
  const picks: Pick[] = [];
  for (const p of parsed.picks) {
    const match = offered.get(normalizeCourseCode(p.code) ?? "");
    if (match && !picks.some((q) => q.match === match)) picks.push({ match, why: tidyWhy(p.why) });
  }
  return picks.length ? picks.slice(0, limit) : null;
}

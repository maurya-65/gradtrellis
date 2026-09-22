import { afterEach, describe, expect, it, vi } from "vitest";
import { courseIndex } from "../src/catalog.ts";
import { complete } from "../src/advisor/models.ts";
import { rerank, scrub } from "../src/advisor/rerank.ts";
import type { Match } from "../src/advisor/search.ts";

const candidates: Match[] = ["CS 3735", "CS 2545", "CS 4545"].map((code, i) => ({ course: courseIndex.get(code)!, similarity: 0.6 - i / 10, score: 0.6 - i / 10 }));
const reply = (text: string | null) => async () => text;

describe("rerank", () => {
  it("takes the model's order and reasons, only for courses it was offered", async () => {
    const picks = await rerank(
      "machine learning",
      candidates,
      5,
      reply('Sure! {"picks":[{"code":"cs 4545","why":"Big data systems.\\nUseful for ML at scale."},{"code":"CS 9999","why":"made up"},{"code":"CS 3735","why":"The core machine learning course"}]}'),
    );
    expect(picks?.map((p) => [p.match.course.code, p.why])).toEqual([
      ["CS 4545", "Big data systems. Useful for ML at scale"],
      ["CS 3735", "The core machine learning course"],
    ]);
  });

  it("keeps reasons short and stops at the limit", async () => {
    const long = "word ".repeat(60);
    const picks = await rerank("x", candidates, 1, reply(JSON.stringify({ picks: [{ code: "CS 3735", why: long }, { code: "CS 2545", why: "ok" }] })));
    expect(picks).toHaveLength(1);
    expect(picks![0]!.why.length).toBeLessThanOrEqual(111);
    expect(picks![0]!.why.endsWith("…")).toBe(true);
  });

  it("gives up (so the local order stands) on no reply, bad JSON or nothing usable", async () => {
    expect(await rerank("x", candidates, 5, reply(null))).toBeNull();
    expect(await rerank("x", candidates, 5, reply("I think CS 3735"))).toBeNull();
    expect(await rerank("x", candidates, 5, reply('{"picks":[{"code":"CS 9999","why":"?"}]}'))).toBeNull();
  });

  it("keeps student numbers and emails out of what it sends", async () => {
    expect(scrub("i'm 3784280, me@unb.ca, into ai")).toBe("i'm [number], [email] into ai");
    const ask = vi.fn(async (_system: string, _user: string): Promise<string | null> => null);
    await rerank("my number is 1234567", candidates, 5, ask);
    expect(ask.mock.calls[0]![1]).toContain("Question: my number is [number]");
  });
});

describe("the free-model chain", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));

  it("uses no provider without a key", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("MISTRAL_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await complete("s", "u")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("moves on to the next provider when one fails", async () => {
    vi.stubEnv("GROQ_API_KEY", "g");
    vi.stubEnv("MISTRAL_API_KEY", "m");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = vi.fn().mockResolvedValueOnce(new Response("slow down", { status: 429 })).mockResolvedValueOnce(ok("from mistral"));
    vi.stubGlobal("fetch", fetch);

    expect(await complete("s", "u")).toBe("from mistral");
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(["https://api.groq.com/openai/v1/chat/completions", "https://api.mistral.ai/v1/chat/completions"]);
    expect(fetch.mock.calls[1]![1].headers.authorization).toBe("Bearer m");
  });
});

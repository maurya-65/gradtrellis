// The free-tier model chain. Each provider speaks the OpenAI chat-completions format, so one
// small client covers them. A provider is used only when its key is set; on any failure (rate
// limit, outage, timeout, empty reply) the next one is tried. Free tiers change their terms and
// models often, so the model names can be overridden in .env.

interface Provider {
  name: string;
  url: string;
  key: string | undefined;
  model: string;
}

// read on each call so a key added to .env counts after a restart, and tests can set them
function providers(): Provider[] {
  const env = process.env;
  return [
    { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", key: env.GROQ_API_KEY, model: env.GROQ_MODEL ?? "openai/gpt-oss-120b" },
    { name: "Mistral", url: "https://api.mistral.ai/v1/chat/completions", key: env.MISTRAL_API_KEY, model: env.MISTRAL_MODEL ?? "mistral-small-latest" },
    {
      name: "Gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL ?? "gemini-3.8-flash",
    },
  ];
}

// a slow answer is worse than the local one
const TIMEOUT_MS = 8000;

// The first reply from the chain, or null when no provider is set up or none answered.
export async function complete(system: string, user: string): Promise<string | null> {
  for (const p of providers().filter((p) => p.key)) {
    try {
      const res = await fetch(p.url, {
        method: "POST",
        headers: { authorization: `Bearer ${p.key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0,
          // room for reasoning models' thinking as well as the reply
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`${p.name} answered ${res.status}; trying the next model`);
        continue;
      }
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const text = body.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim()) return text;
    } catch (err) {
      console.warn(`${p.name} failed (${err instanceof Error ? err.message : err}); trying the next model`);
    }
  }
  return null;
}

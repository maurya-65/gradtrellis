import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const USER_AGENT =
  "GradTrellis/0.1 (student degree-planning project; polite scraper, cached, 1 request / 2s)";

export interface FetchOptions {
  cacheDir: string;
  delayMs?: number;
  refresh?: boolean;
}

let lastRequestAt = 0;

// cached on disk so we don't hit UNB twice for the same page
export async function politeFetch(url: string, opts: FetchOptions): Promise<string> {
  const key = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const path = join(opts.cacheDir, `${key}.html`);

  if (!opts.refresh) {
    try {
      return await readFile(path, "utf8");
    } catch {
      // not cached yet
    }
  }

  const wait = lastRequestAt + (opts.delayMs ?? 2000) - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const body = await res.text();

  await mkdir(opts.cacheDir, { recursive: true });
  await writeFile(path, body, "utf8");
  return body;
}

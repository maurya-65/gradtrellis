// Embeds every course in the current listings for the advisor's search. Run after scraping a
// new calendar: npm run embed
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { courseText, embed, encodeVectors, MODEL, type EmbeddingFile } from "../src/advisor/embeddings.ts";
import { courseVectorsFile } from "../src/advisor/search.ts";
import { snapshot } from "../src/catalog.ts";

const BATCH = 64;

const vectors: Float32Array[] = [];
for (let i = 0; i < snapshot.courses.length; i += BATCH) {
  vectors.push(...(await embed(snapshot.courses.slice(i, i + BATCH).map(courseText))));
  process.stdout.write(`\rembedded ${vectors.length} of ${snapshot.courses.length}`);
}

const file: EmbeddingFile = { model: MODEL, dims: vectors[0]!.length, codes: snapshot.courses.map((c) => c.code), vectors: encodeVectors(vectors) };
mkdirSync(dirname(courseVectorsFile), { recursive: true });
writeFileSync(courseVectorsFile, JSON.stringify(file));
console.log(`\nwrote ${courseVectorsFile}`);

// Sentence embeddings from a small open model that runs locally, so course search by meaning
// costs nothing and sends nothing anywhere. Course vectors are computed once by
// scripts/embed-courses.ts; only questions are embedded at runtime.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { Course } from "../engine/index.ts";

export const MODEL = "Xenova/all-MiniLM-L6-v2";

// downloaded on first use (~23 MB) and kept out of git
env.cacheDir = join(import.meta.dirname, "..", "..", ".cache", "models");

let extractor: Promise<FeatureExtractionPipeline> | null = null;

// unit-length vectors, so a dot product is the cosine similarity
export async function embed(texts: string[]): Promise<Float32Array[]> {
  extractor ??= pipeline("feature-extraction", MODEL, { dtype: "q8" });
  const output = await (await extractor)(texts, { pooling: "mean", normalize: true });
  const dims = output.dims.at(-1)!;
  const data = output.data as Float32Array;
  return texts.map((_, i) => data.slice(i * dims, (i + 1) * dims));
}

// what a course is embedded as
export function courseText(course: Course): string {
  return `${course.title}. ${course.description}`;
}

// Stored as signed bytes (value × 127) in base64: a quarter of the size of floats and plenty
// precise for ranking.
export interface EmbeddingFile {
  model: string;
  dims: number;
  codes: string[];
  vectors: string;
}

export function encodeVectors(vectors: Float32Array[]): string {
  const bytes = new Int8Array(vectors.length * vectors[0]!.length);
  vectors.forEach((v, i) => v.forEach((x, j) => (bytes[i * v.length + j] = Math.round(x * 127))));
  return Buffer.from(bytes.buffer).toString("base64");
}

export interface CourseVectors {
  codes: string[];
  dims: number;
  vectors: Int8Array;
}

export function loadCourseVectors(file: string): CourseVectors | null {
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, "utf8")) as EmbeddingFile;
  if (parsed.model !== MODEL) throw new Error(`${file} was made with ${parsed.model}, not ${MODEL}; run npm run embed`);
  const buffer = Buffer.from(parsed.vectors, "base64");
  return { codes: parsed.codes, dims: parsed.dims, vectors: new Int8Array(buffer.buffer, buffer.byteOffset, buffer.length) };
}

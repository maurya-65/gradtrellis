import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseTranscript, toLines, type ParsedTranscript, type TextRun } from "./parse.ts";

// Server side: reads an uploaded PDF so the student number is checked on what was actually
// uploaded, not on what the browser says it found.
export async function readTranscript(data: Buffer): Promise<ParsedTranscript> {
  // pdf.js takes ownership of the array, so give it a copy
  const task = getDocument({ data: new Uint8Array(data), verbosity: 0 });
  try {
    const doc = await task.promise;
    const lines: string[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const { items } = await (await doc.getPage(p)).getTextContent();
      lines.push(...toLines(items.filter((i): i is TextRun & typeof i => "str" in i)));
    }
    return parseTranscript(lines);
  } finally {
    await task.destroy();
  }
}

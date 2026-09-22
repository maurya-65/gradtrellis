import { toLines, type TextRun } from "backend/transcript";

// Reads a PDF into lines of cells, in page order. pdf.js is loaded only when needed,
// since it's large and most visits never import a transcript.
export async function readPdfLines(data: ArrayBuffer): Promise<string[][]> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const lines: string[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    lines.push(...toLines(items.filter((i): i is TextRun & typeof i => "str" in i)));
  }
  await task.destroy();
  return lines;
}

import type { TextItem } from "pdfjs-dist/types/src/display/api";

// Anything wider than a couple of spaces separates two columns.
const COLUMN_GAP = 10;

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
    lines.push(...toLines(items.filter((i): i is TextItem => "str" in i)));
  }
  await task.destroy();
  return lines;
}

function toLines(items: TextItem[]): string[][] {
  // group words by baseline, top of the page first
  const rows = new Map<number, TextItem[]>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    rows.set(y, [...(rows.get(y) ?? []), item]);
  }

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => {
      row.sort((a, b) => a.transform[4] - b.transform[4]);
      const cells: string[] = [];
      let end = -Infinity;
      for (const item of row) {
        const x = item.transform[4];
        if (x - end > COLUMN_GAP || cells.length === 0) cells.push(item.str);
        else cells[cells.length - 1] += ` ${item.str}`;
        end = x + item.width;
      }
      return cells;
    });
}

// Builds a small one-page PDF with each row's cells in wide columns, like the myUNB
// unofficial transcript, so tests can upload a "real" transcript without anyone's data.
export function transcriptPdf(rows: string[][]): Buffer {
  const text = rows
    .flatMap((cells, r) => cells.map((cell, c) => `BT /F1 9 Tf ${50 + c * 200} ${760 - r * 12} Td (${cell.replace(/[()\\]/g, "\\$&")}) Tj ET`))
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// a first-year transcript for the given student number
export function sampleTranscript(studentNumber: string, name = "Student, Test"): Buffer {
  return transcriptPdf([
    ["UNOFFICIAL TRANSCRIPT"],
    [studentNumber, name],
    ["2024/FA", "BCS", "Fredericton"],
    ["CS*1073", "INTR COMP PROG I (IN JAVA)", "A", "4.00", "16.00"],
    ["MATH*1003", "CALCULUS I", "B+", "3.00", "9.90"],
  ]);
}

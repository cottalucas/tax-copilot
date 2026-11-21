/**
 * Builds small, valid, synthetic PDFs for evals and tests. No client data ever goes through here.
 * - textPdf: one page per string, with a real text layer (like a PDF exported from software).
 * - imagePdf: one page that is only a JPEG picture, no text layer (like a scanner's output).
 */

/** Wraps a line at word boundaries so it stays on the page. */
export function wrap(line: string, width = 85): string[] {
  const out: string[] = [];
  let current = "";
  for (const word of line.split(" ")) {
    if (current && (current + " " + word).length > width) {
      out.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  out.push(current);
  return out;
}

function assemble(objects: string[], binary: Map<number, Buffer> = new Map()): Buffer {
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  let length = parts[0]!.length;
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = length;
    const bin = binary.get(id);
    const chunk = bin
      ? Buffer.concat([Buffer.from(`${id} 0 obj\n${objects[id]}\nstream\n`, "latin1"), bin, Buffer.from("\nendstream\nendobj\n", "latin1")])
      : Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`, "latin1");
    parts.push(chunk);
    length += chunk.length;
  }
  let tail = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) tail += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  tail += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  parts.push(Buffer.from(tail, "latin1"));
  return Buffer.concat(parts);
}

/** A text PDF: one page per entry, lines split on "\n" and wrapped. Latin-1 text only. */
export function textPdf(pages: string[]): Buffer {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  pages.forEach((text, i) => {
    const lines = text.split("\n").flatMap((l) => wrap(l));
    const stream = `BT /F1 10 Tf 60 740 Td 14 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;
    const id = pageIds[i]!;
    objects[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`;
    objects[id + 1] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  });
  return assemble(objects);
}

/** A scanned page: the JPEG fills one A4 page. No text layer at all. */
export function imagePdf(jpeg: Buffer, widthPx: number, heightPx: number): Buffer {
  const pageW = 595;
  const pageH = Math.round((pageW * heightPx) / widthPx);
  const draw = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im1 Do Q`;
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`;
  objects[4] = `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`;
  objects[5] = `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`;
  return assemble(objects, new Map([[4, jpeg]]));
}

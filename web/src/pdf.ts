/**
 * Turns a PDF into plain text per page, in her browser (SR-18). pdf.js loads only when needed,
 * so the queue stays light. Text only: scanned PDFs give empty pages.
 */
export interface TextItem {
  str?: string;
  hasEOL?: boolean;
}

/** Joins pdf.js text items into one page of text: line ends become new lines. */
export function joinTextItems(items: TextItem[]): string {
  return items
    .map((i) => (i.str ?? "") + (i.hasEOL ? "\n" : " "))
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function pdfPages(data: ArrayBuffer, maxPages: number): Promise<string[]> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  try {
    if (doc.numPages > maxPages) throw new Error(`has ${doc.numPages} pages, more than ${maxPages}.`);
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      pages.push(joinTextItems((await page.getTextContent()).items as TextItem[]));
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

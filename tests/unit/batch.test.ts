import { describe, expect, it } from "vitest";
import { DATA_FILE_NAME, MAX_FILES, pendingExtraction, runBatch, taxYearFor, type BatchDeps } from "../../web/src/batch.js";
import { pdfQuery } from "../../web/src/drive.js";
import { joinTextItems } from "../../web/src/pdf.js";
import type { QueueClient } from "../../web/src/queue.js";

const client = (id: string, over: Partial<QueueClient> = {}): QueueClient => ({
  id,
  displayName: `Client ${id}`,
  status: "documents_in",
  flagCount: 0,
  driveFolderId: `folder-${id}`,
  extracted: false,
  ...over,
});

function fakeDeps(over: Partial<BatchDeps> = {}) {
  const saved: { folderId: string; name: string; json: string }[] = [];
  const recorded: { clientId: string; dataFileId: string }[] = [];
  const extracted: Parameters<BatchDeps["extract"]>[0][] = [];
  const deps: BatchDeps = {
    listPdfs: async (folderId) => [
      { id: `${folderId}-a`, name: "salary-statement.pdf" },
      { id: `${folderId}-b`, name: "bank-statement.pdf" },
    ],
    download: async (id) => new TextEncoder().encode(id).buffer as ArrayBuffer,
    pdfPages: async (data) => [`text of ${new TextDecoder().decode(data)}`],
    extract: async (input) => {
      extracted.push(input);
      return { data: { schemaVersion: 1, taxpayer: { clientId: input.clientId, taxYear: input.taxYear } }, model: "test-model" };
    },
    saveDataFile: async (folderId, name, json) => {
      saved.push({ folderId, name, json });
      return `data-${folderId}`;
    },
    saveExtraction: async (input) => void recorded.push(input),
    now: () => new Date("2026-03-01T10:00:00Z"),
    ...over,
  };
  return { deps, saved, recorded, extracted };
}

describe("batch extraction", () => {
  it("picks clients with documents in, a Drive folder and no data file", () => {
    const list = [client("1"), client("2", { extracted: true }), client("3", { status: "needs_review" }), client("4", { driveFolderId: undefined })];
    expect(pendingExtraction(list).map((c) => c.id)).toEqual(["1"]);
  });

  it("prepares last year's return", () => {
    expect(taxYearFor(new Date("2026-03-01"))).toBe(2025);
  });

  it("extracts each client from its PDFs and saves one data file next to them", async () => {
    const { deps, saved, recorded, extracted } = fakeDeps();
    const progress: string[] = [];
    const out = await runBatch([client("1"), client("2")], deps, (m) => progress.push(m));
    expect(out).toEqual({ done: ["Client 1", "Client 2"], failed: [] });
    expect(progress).toEqual(["Extracting Client 1 (1 of 2)", "Extracting Client 2 (2 of 2)"]);
    expect(extracted[0]).toEqual({
      clientId: "1",
      taxYear: 2025,
      documents: [
        { file: "salary-statement.pdf", pages: ["text of folder-1-a"] },
        { file: "bank-statement.pdf", pages: ["text of folder-1-b"] },
      ],
    });
    expect(saved.map((s) => [s.folderId, s.name])).toEqual([
      ["folder-1", DATA_FILE_NAME],
      ["folder-2", DATA_FILE_NAME],
    ]);
    expect(JSON.parse(saved[0]!.json)).toMatchObject({
      schemaVersion: 1,
      model: "test-model",
      extractedAt: "2026-03-01T10:00:00.000Z",
      sources: ["salary-statement.pdf", "bank-statement.pdf"],
      data: { taxpayer: { clientId: "1" } },
    });
    expect(recorded).toEqual([
      { clientId: "1", dataFileId: "data-folder-1" },
      { clientId: "2", dataFileId: "data-folder-2" },
    ]);
  });

  it("keeps going when one client fails, and saves nothing for it", async () => {
    const { deps, saved, recorded } = fakeDeps({
      extract: async (input) => {
        if (input.clientId === "1") throw new Error("Extraction failed. Try again.");
        return { data: {}, model: "m" };
      },
    });
    const out = await runBatch([client("1"), client("2")], deps);
    expect(out).toEqual({ done: ["Client 2"], failed: [{ name: "Client 1", reason: "Extraction failed. Try again." }] });
    expect(saved.map((s) => s.folderId)).toEqual(["folder-2"]);
    expect(recorded.map((r) => r.clientId)).toEqual(["2"]);
  });

  it("explains empty folders, too many files, unreadable PDFs and scans, without calling the model", async () => {
    const cases: [Partial<BatchDeps>, string][] = [
      [{ listPdfs: async () => [] }, "No PDFs found in the client's Drive folder."],
      [{ listPdfs: async () => Array.from({ length: MAX_FILES + 1 }, (_, i) => ({ id: `f${i}`, name: `f${i}.pdf` })) }, `More than ${MAX_FILES} PDFs`],
      [{ pdfPages: async () => Promise.reject(new Error("broken")) }, "salary-statement.pdf: could not be read (broken)"],
      [{ pdfPages: async () => ["", "  "] }, "No text found in these PDFs."],
    ];
    for (const [over, reason] of cases) {
      const { deps, extracted } = fakeDeps(over);
      const out = await runBatch([client("1")], deps);
      expect(out.failed[0]?.reason).toContain(reason);
      expect(extracted).toHaveLength(0);
    }
  });
});

describe("pdf text", () => {
  it("joins items into lines and trims spacing", () => {
    expect(joinTextItems([{ str: "Gross salary", hasEOL: false }, { str: "98000.00", hasEOL: true }, { str: "Net  salary" }, {}])).toBe("Gross salary 98000.00\nNet salary");
  });
});

describe("drive query", () => {
  it("lists only PDFs in the folder and escapes quotes", () => {
    expect(pdfQuery("abc")).toBe("'abc' in parents and mimeType='application/pdf' and trashed=false");
    expect(pdfQuery("a'b")).toBe("'a\\'b' in parents and mimeType='application/pdf' and trashed=false");
  });
});

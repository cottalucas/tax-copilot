/**
 * Batch extraction (SR-18), run from her browser. For each client: read the PDFs from her Drive,
 * turn them into text, extract through the extract function (Vertex, EU), save the data file next
 * to the PDFs in her Drive, then record its id. One client failing does not stop the others.
 */
import type { QueueClient } from "./queue.js";

export const DATA_FILE_NAME = "tax-copilot-data.json";
/** Same limits as the extract function (src/functions/extract.ts LIMITS). */
export const MAX_FILES = 30;
export const MAX_PAGES = 200;

export interface DocumentText {
  file: string;
  pages: string[];
}

export interface BatchDeps {
  listPdfs(folderId: string): Promise<{ id: string; name: string }[]>;
  download(fileId: string): Promise<ArrayBuffer>;
  pdfPages(data: ArrayBuffer, maxPages: number): Promise<string[]>;
  extract(input: { clientId: string; taxYear: number; documents: DocumentText[] }): Promise<{ data: unknown; model: string }>;
  saveDataFile(folderId: string, name: string, json: string): Promise<string>;
  saveExtraction(input: { clientId: string; dataFileId: string }): Promise<void>;
  now(): Date;
}

export interface BatchOutcome {
  done: string[];
  failed: { name: string; reason: string }[];
}

/** Clients waiting for extraction: documents in, files in Drive, no data file yet. */
export function pendingExtraction(clients: QueueClient[]): QueueClient[] {
  return clients.filter((c) => c.status === "documents_in" && c.driveFolderId && !c.extracted);
}

/** The return being prepared is for last year. */
export function taxYearFor(now: Date): number {
  return now.getFullYear() - 1;
}

async function extractOne(client: QueueClient, deps: BatchDeps): Promise<void> {
  const folderId = client.driveFolderId!;
  const files = await deps.listPdfs(folderId);
  if (files.length === 0) throw new Error("No PDFs found in the client's Drive folder.");
  if (files.length > MAX_FILES) throw new Error(`More than ${MAX_FILES} PDFs in the client's Drive folder.`);
  const documents: DocumentText[] = [];
  for (const f of files) {
    try {
      documents.push({ file: f.name, pages: await deps.pdfPages(await deps.download(f.id), MAX_PAGES) });
    } catch (err) {
      throw new Error(`${f.name}: could not be read (${(err as Error).message})`, { cause: err });
    }
  }
  if (documents.every((d) => d.pages.every((p) => p.trim() === ""))) {
    throw new Error("No text found in these PDFs. Scanned PDFs are not supported yet.");
  }
  const taxYear = taxYearFor(deps.now());
  const result = await deps.extract({ clientId: client.id, taxYear, documents });
  const file = { schemaVersion: 1, extractedAt: deps.now().toISOString(), model: result.model, sources: files.map((f) => f.name), data: result.data };
  const dataFileId = await deps.saveDataFile(folderId, DATA_FILE_NAME, JSON.stringify(file, null, 2));
  await deps.saveExtraction({ clientId: client.id, dataFileId });
}

export async function runBatch(
  clients: QueueClient[],
  deps: BatchDeps,
  progress: (message: string) => void = () => {},
): Promise<BatchOutcome> {
  const outcome: BatchOutcome = { done: [], failed: [] };
  for (const [i, client] of clients.entries()) {
    progress(`Extracting ${client.displayName} (${i + 1} of ${clients.length})`);
    try {
      await extractOne(client, deps);
      outcome.done.push(client.displayName);
    } catch (err) {
      outcome.failed.push({ name: client.displayName, reason: (err as Error).message || "Something went wrong." });
    }
  }
  return outcome;
}

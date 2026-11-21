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

/** Tax years she can choose from: the last three. She always picks one, nothing is preselected. */
export function taxYearChoices(now: Date): number[] {
  const y = now.getFullYear();
  return [y - 1, y - 2, y - 3];
}

/**
 * One unique label per PDF, so every citation names exactly one file. Drive allows two files with
 * the same name in a folder: a repeat becomes "name (2).pdf".
 */
export function uniqueLabels(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    let label = name;
    for (let n = 2; used.has(label); n++) {
      const dot = name.toLowerCase().endsWith(".pdf") ? name.length - 4 : name.length;
      label = `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
    }
    used.add(label);
    return label;
  });
}

async function extractOne(client: QueueClient, taxYear: number, deps: BatchDeps): Promise<void> {
  const folderId = client.driveFolderId!;
  const files = await deps.listPdfs(folderId);
  if (files.length === 0) throw new Error("No PDFs found in the client's Drive folder.");
  if (files.length > MAX_FILES) throw new Error(`More than ${MAX_FILES} PDFs in the client's Drive folder.`);
  const labels = uniqueLabels(files.map((f) => f.name));
  const documents: DocumentText[] = [];
  for (const [i, f] of files.entries()) {
    try {
      documents.push({ file: labels[i]!, pages: await deps.pdfPages(await deps.download(f.id), MAX_PAGES) });
    } catch (err) {
      throw new Error(`${f.name}: could not be read (${(err as Error).message})`, { cause: err });
    }
  }
  if (documents.every((d) => d.pages.every((p) => p.trim() === ""))) {
    throw new Error("No text found in these PDFs. Scanned PDFs are not supported yet.");
  }
  const result = await deps.extract({ clientId: client.id, taxYear, documents });
  const file = { schemaVersion: 1, taxYear, extractedAt: deps.now().toISOString(), model: result.model, sources: files.map((f, i) => ({ file: labels[i]!, driveFileId: f.id })), data: result.data };
  const dataFileId = await deps.saveDataFile(folderId, DATA_FILE_NAME, JSON.stringify(file, null, 2));
  await deps.saveExtraction({ clientId: client.id, dataFileId });
}

export async function runBatch(
  clients: QueueClient[],
  taxYear: number,
  deps: BatchDeps,
  progress: (message: string) => void = () => {},
): Promise<BatchOutcome> {
  const outcome: BatchOutcome = { done: [], failed: [] };
  for (const [i, client] of clients.entries()) {
    progress(`Extracting ${client.displayName} (${i + 1} of ${clients.length})`);
    try {
      await extractOne(client, taxYear, deps);
      outcome.done.push(client.displayName);
    } catch (err) {
      outcome.failed.push({ name: client.displayName, reason: (err as Error).message || "Something went wrong." });
    }
  }
  return outcome;
}

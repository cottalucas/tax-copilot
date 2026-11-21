/**
 * Batch extraction (SR-18, SR-28). For each waiting client her browser asks the extract function
 * to read the documents she uploaded. Extraction itself runs on the server. One client failing
 * does not stop the others.
 */
import type { QueueClient } from "./queue.js";

export interface BatchOutcome {
  done: string[];
  failed: { name: string; reason: string }[];
}

/** Clients waiting for extraction: documents in, no extracted values yet. */
export function pendingExtraction(clients: QueueClient[]): QueueClient[] {
  return clients.filter((c) => c.status === "documents_in" && !c.extracted);
}

export async function runBatch(
  clients: QueueClient[],
  extract: (clientId: string) => Promise<void>,
  progress: (message: string) => void = () => {},
): Promise<BatchOutcome> {
  const outcome: BatchOutcome = { done: [], failed: [] };
  for (const [i, client] of clients.entries()) {
    progress(`Reading documents for ${client.displayName} (${i + 1} of ${clients.length})`);
    try {
      await extract(client.id);
      outcome.done.push(client.displayName);
    } catch (err) {
      outcome.failed.push({ name: client.displayName, reason: (err as Error).message || "Something went wrong." });
    }
  }
  return outcome;
}

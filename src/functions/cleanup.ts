import { clientPrefix, FILES_DELETE_AFTER_DAYS, type StoredFile } from "./extract.js";

/**
 * Daily cleanup (SR-28). A second deletion path next to the bucket lifecycle and the Firestore
 * TTL, which both run in the background without a deadline guarantee:
 * - a submitted return keeps no documents and no extracted values (retries a failed submit cleanup),
 * - extracted values past expireAt are deleted,
 * - documents older than 28 days are deleted.
 * Logs counts only.
 */
export interface CleanupDeps {
  now: () => Date;
  listClients(): Promise<{ id: string; ownerUid: string; status: string }[]>;
  /** expireAt of the client's extracted values, or undefined when there are none. */
  getValuesExpiry(clientId: string): Promise<Date | undefined>;
  deleteValues(clientId: string): Promise<void>;
  listFiles(prefix: string): Promise<StoredFile[]>;
  deleteFile(name: string): Promise<void>;
  log?: (message: string, fields: Record<string, unknown>) => void;
}

export interface CleanupResult {
  submittedFiles: number;
  submittedValues: number;
  expiredValues: number;
  expiredFiles: number;
}

const DAY = 24 * 3600 * 1000;

export async function runCleanup(deps: CleanupDeps): Promise<CleanupResult> {
  const now = deps.now();
  const result: CleanupResult = { submittedFiles: 0, submittedValues: 0, expiredValues: 0, expiredFiles: 0 };
  for (const client of await deps.listClients()) {
    const expiry = await deps.getValuesExpiry(client.id);
    if (client.status === "submitted") {
      for (const f of await deps.listFiles(clientPrefix(client.ownerUid, client.id))) {
        await deps.deleteFile(f.name);
        result.submittedFiles += 1;
      }
      if (expiry) {
        await deps.deleteValues(client.id);
        result.submittedValues += 1;
      }
    } else if (expiry && expiry.getTime() <= now.getTime()) {
      await deps.deleteValues(client.id);
      result.expiredValues += 1;
    }
  }
  const cutoff = now.getTime() - FILES_DELETE_AFTER_DAYS * DAY;
  for (const f of await deps.listFiles("users/")) {
    if (f.created.getTime() <= cutoff) {
      await deps.deleteFile(f.name);
      result.expiredFiles += 1;
    }
  }
  deps.log?.("cleanup", { ...result });
  return result;
}

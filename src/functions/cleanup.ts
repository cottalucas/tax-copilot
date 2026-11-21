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
  /** Deletes the client's extracted values. Resolves true when there were any. */
  deleteValues(clientId: string): Promise<boolean>;
  listFiles(prefix: string): Promise<StoredFile[]>;
  deleteFile(name: string): Promise<void>;
  log?: (message: string, fields: Record<string, unknown>) => void;
}

export interface CleanupResult {
  submittedFiles: number;
  submittedValues: number;
  expiredValues: number;
  expiredFiles: number;
  /** Steps that failed. The run goes on past them, then fails so the scheduler retries it. */
  failures: number;
}

const DAY = 24 * 3600 * 1000;

export async function runCleanup(deps: CleanupDeps): Promise<CleanupResult> {
  const now = deps.now();
  const result: CleanupResult = { submittedFiles: 0, submittedValues: 0, expiredValues: 0, expiredFiles: 0, failures: 0 };
  // One failed step never stops the rest of the sweep.
  const attempt = async (step: () => Promise<void>) => {
    try {
      await step();
    } catch {
      result.failures += 1;
    }
  };
  let clients: Awaited<ReturnType<CleanupDeps["listClients"]>> = [];
  await attempt(async () => {
    clients = await deps.listClients();
  });
  for (const client of clients) {
    if (client.status === "submitted") {
      // Files and values are separate steps: a failure in one never skips the other.
      await attempt(async () => {
        for (const f of await deps.listFiles(clientPrefix(client.ownerUid, client.id))) {
          await attempt(async () => {
            await deps.deleteFile(f.name);
            result.submittedFiles += 1;
          });
        }
      });
      await attempt(async () => {
        if (await deps.deleteValues(client.id)) result.submittedValues += 1;
      });
    } else {
      await attempt(async () => {
        const expiry = await deps.getValuesExpiry(client.id);
        if (expiry && expiry.getTime() <= now.getTime() && (await deps.deleteValues(client.id))) result.expiredValues += 1;
      });
    }
  }
  const cutoff = now.getTime() - FILES_DELETE_AFTER_DAYS * DAY;
  const deleted = new Set<string>();
  const sweep = async (prefix: string) => {
    for (const f of (await deps.listFiles(prefix)).filter((x) => x.created.getTime() <= cutoff && !deleted.has(x.name))) {
      await attempt(async () => {
        await deps.deleteFile(f.name);
        deleted.add(f.name);
        result.expiredFiles += 1;
      });
    }
  };
  // Old documents: each client's folder is its own step, so one failed listing skips only that
  // client. A last pass over all of users/ catches anything outside a known client folder.
  for (const client of clients) await attempt(() => sweep(clientPrefix(client.ownerUid, client.id)));
  await attempt(() => sweep("users/"));
  deps.log?.("cleanup", { ...result });
  if (result.failures > 0) throw new Error(`Cleanup had ${result.failures} failed steps; the scheduler retries it.`);
  return result;
}

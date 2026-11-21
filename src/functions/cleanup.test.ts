import { describe, expect, it } from "vitest";
import { runCleanup, type CleanupDeps } from "./cleanup.js";
import { clientPrefix, type StoredFile } from "./extract.js";

const now = new Date("2026-04-01T00:00:00Z");
const day = 24 * 3600 * 1000;
const file = (uid: string, client: string, name: string, ageDays: number): StoredFile => ({
  name: `${clientPrefix(uid, client)}${name}`,
  contentType: "application/pdf",
  size: 1,
  created: new Date(now.getTime() - ageDays * day),
});

function fake() {
  const files = [file("u1", "open", "a.pdf", 3), file("u1", "old", "b.pdf", 28), file("u1", "old", "c.pdf", 29), file("u1", "done", "d.pdf", 1)];
  const values = new Map<string, Date>([
    ["open", new Date(now.getTime() + day)],
    ["expired", new Date(now.getTime() - 1000)],
    ["done", new Date(now.getTime() + 10 * day)],
  ]);
  const deletedFiles: string[] = [];
  const deletedValues: string[] = [];
  const logs: Record<string, unknown>[] = [];
  const deps: CleanupDeps = {
    now: () => now,
    listClients: async () => [
      { id: "open", ownerUid: "u1", status: "documents_in" },
      { id: "expired", ownerUid: "u1", status: "documents_in" },
      { id: "old", ownerUid: "u1", status: "documents_in" },
      { id: "done", ownerUid: "u1", status: "submitted" },
    ],
    deleteExpiredValues: async (id, at) => {
      const exp = values.get(id);
      if (!exp || exp.getTime() > at.getTime()) return false;
      values.delete(id);
      deletedValues.push(id);
      return true;
    },
    deleteValues: async (id) => {
      if (!values.delete(id)) return false;
      deletedValues.push(id);
      return true;
    },
    listFiles: async (prefix) => files.filter((f) => f.name.startsWith(prefix) && !deletedFiles.includes(f.name)),
    deleteFile: async (name) => void deletedFiles.push(name),
    log: (message, fields) => void logs.push({ message, ...fields }),
  };
  return { deps, deletedFiles, deletedValues, logs };
}

describe("daily cleanup", () => {
  it("clears submitted returns, expired values and documents 28 days old, and nothing else", async () => {
    const { deps, deletedFiles, deletedValues, logs } = fake();
    expect(await runCleanup(deps)).toEqual({ submittedFiles: 1, submittedValues: 1, expiredValues: 1, expiredFiles: 2, failures: 0 });
    expect(deletedValues.sort()).toEqual(["done", "expired"]);
    expect(deletedFiles.sort()).toEqual([`${clientPrefix("u1", "done")}d.pdf`, `${clientPrefix("u1", "old")}b.pdf`, `${clientPrefix("u1", "old")}c.pdf`].sort());
    // Counts only in the log.
    expect(logs).toEqual([{ message: "cleanup", submittedFiles: 1, submittedValues: 1, expiredValues: 1, expiredFiles: 2, failures: 0 }]);
  });

  it("does nothing on a second run", async () => {
    const { deps } = fake();
    await runCleanup(deps);
    expect(await runCleanup(deps)).toEqual({ submittedFiles: 0, submittedValues: 0, expiredValues: 0, expiredFiles: 0, failures: 0 });
  });

  it("on a submitted return, a failed file listing still deletes the values", async () => {
    const { deps, deletedValues } = fake();
    const failing: CleanupDeps = {
      ...deps,
      listFiles: async (prefix) => {
        if (prefix.includes("/done/")) throw new Error("storage unavailable");
        return deps.listFiles(prefix);
      },
      deleteExpiredValues: async (id, at) => {
        if (id === "done") throw new Error("never used for a submitted return");
        return deps.deleteExpiredValues(id, at);
      },
    };
    await expect(runCleanup(failing)).rejects.toThrow(/failed steps/);
    expect(deletedValues).toContain("done");
  });

  it("one client's failed listing still lets old documents of other clients go", async () => {
    const { deps, deletedFiles } = fake();
    const failing: CleanupDeps = {
      ...deps,
      listFiles: async (prefix) => {
        if (prefix === "users/" || prefix.includes("/open/")) throw new Error("storage unavailable");
        return deps.listFiles(prefix);
      },
    };
    await expect(runCleanup(failing)).rejects.toThrow(/failed steps/);
    expect(deletedFiles.filter((f) => f.includes("/old/")).length).toBe(2);
  });

  it("goes on past a failed step, then fails so the scheduler retries", async () => {
    const { deps, deletedFiles, deletedValues, logs } = fake();
    const failing: CleanupDeps = {
      ...deps,
      deleteExpiredValues: async (id, at) => {
        if (id === "open") throw new Error("firestore unavailable");
        return deps.deleteExpiredValues(id, at);
      },
      deleteFile: async (name) => {
        if (name.endsWith("b.pdf")) throw new Error("storage unavailable");
        return deps.deleteFile(name);
      },
    };
    // b.pdf fails twice (its client folder, then the last pass), plus the failed lookup.
    await expect(runCleanup(failing)).rejects.toThrow(/3 failed steps/);
    // Later clients and expired files were still handled.
    expect(deletedValues.sort()).toEqual(["done", "expired"]);
    expect(deletedFiles.some((f) => f.endsWith("c.pdf"))).toBe(true);
    expect(logs.at(-1)).toMatchObject({ message: "cleanup", failures: 3 });
  });
});

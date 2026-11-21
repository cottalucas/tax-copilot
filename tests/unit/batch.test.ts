import { describe, expect, it } from "vitest";
import { pendingExtraction, runBatch } from "../../web/src/batch.js";
import type { QueueClient } from "../../web/src/queue.js";

const client = (id: string, over: Partial<QueueClient> = {}): QueueClient => ({ id, displayName: `Client ${id}`, status: "documents_in", flagCount: 0, extracted: false, ...over });

describe("batch extraction", () => {
  it("picks clients with documents in and no extracted values", () => {
    const list = [client("1"), client("2", { extracted: true }), client("3", { status: "needs_review" })];
    expect(pendingExtraction(list).map((c) => c.id)).toEqual(["1"]);
  });

  it("asks the server to read each client in turn, reporting progress", async () => {
    const asked: string[] = [];
    const progress: string[] = [];
    const out = await runBatch([client("1"), client("2")], async (id) => void asked.push(id), (m) => progress.push(m));
    expect(out).toEqual({ done: ["Client 1", "Client 2"], failed: [] });
    expect(asked).toEqual(["1", "2"]);
    expect(progress).toEqual(["Reading documents for Client 1 (1 of 2)", "Reading documents for Client 2 (2 of 2)"]);
  });

  it("keeps going when one client fails and says why", async () => {
    const out = await runBatch([client("1"), client("2")], async (id) => {
      if (id === "1") throw new Error("Extraction failed. Try again.");
    });
    expect(out).toEqual({ done: ["Client 2"], failed: [{ name: "Client 1", reason: "Extraction failed. Try again." }] });
  });
});

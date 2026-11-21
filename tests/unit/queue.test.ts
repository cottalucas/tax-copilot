import { describe, expect, it } from "vitest";
import { groupQueue, nextClient, toQueueClient, type QueueClient } from "../../web/src/queue.js";

const c = (id: string, displayName: string, status: QueueClient["status"], flagCount = 0): QueueClient => ({ id, displayName, status, flagCount, extracted: false });

describe("home queue", () => {
  it("groups by status in the order she works, flagged first, then by name", () => {
    const groups = groupQueue([
      c("1", "Bea", "submitted"),
      c("2", "Ana", "needs_review"),
      c("3", "Cleo", "needs_review", 2),
      c("4", "Dan", "documents_in"),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Needs review", "Documents in", "Submitted"]);
    expect(groups[0]!.clients.map((x) => x.displayName)).toEqual(["Cleo", "Ana"]);
  });

  it("returns no groups for zero clients", () => {
    expect(groupQueue([])).toEqual([]);
  });

  it("drops malformed documents and clamps flag counts", () => {
    expect(toQueueClient("x", { displayName: "Ana", status: "nope" })).toBeUndefined();
    expect(toQueueClient("x", { status: "submitted" })).toBeUndefined();
    expect(toQueueClient("x", { displayName: "Ana", status: "submitted", flagCount: -3 })).toEqual({ id: "x", displayName: "Ana", status: "submitted", flagCount: 0, extracted: false });
  });

  it("knows whether the server saved extracted values", () => {
    expect(toQueueClient("x", { displayName: "Ana", status: "documents_in", extractedAt: { seconds: 1 } })).toMatchObject({ extracted: true });
    expect(toQueueClient("x", { displayName: "Ana", status: "documents_in" })).toEqual({ id: "x", displayName: "Ana", status: "documents_in", flagCount: 0, extracted: false });
  });

  it("picks the next return that needs her: flagged review first, skipping submitted, unread and current", () => {
    const x = (id: string, status: QueueClient["status"], flagCount: number, extracted: boolean): QueueClient => ({ id, displayName: id, status, flagCount, extracted });
    const list = [x("done", "submitted", 0, true), x("ready", "ready_to_fill", 0, true), x("calm", "needs_review", 1, true), x("hot", "needs_review", 3, true), x("unread", "documents_in", 0, false)];
    expect(nextClient(list, "x")?.id).toBe("hot");
    expect(nextClient(list, "hot")?.id).toBe("calm");
    expect(nextClient([x("unread", "documents_in", 0, false), x("done", "submitted", 0, true)], "x")).toBeUndefined();
  });
});

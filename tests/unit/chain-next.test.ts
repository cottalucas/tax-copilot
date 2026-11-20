import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS script without types
import { mergedSince, OWNER_ID, pickNext } from "../../scripts/chain-next.mjs";

const issue = (identifier: string, title: string, extra = {}) => ({ identifier, title, stateType: "backlog", labels: [], blockers: [], ...extra });

describe("build chain picker", () => {
  it("takes the lowest journey step whose blockers are done", () => {
    const next = pickNext([
      issue("SR-18", "3. Extraction", { blockers: ["backlog"] }),
      issue("SR-17", "2. New return and intake"),
      issue("SR-16", "1. Login and home queue", { stateType: "completed" }),
    ]);
    expect(next.identifier).toBe("SR-17");
  });

  it("skips issues that need Lucas and issues already started", () => {
    expect(pickNext([issue("SR-18", "3. Extraction", { labels: ["needs-lucas"] }), issue("SR-17", "2. Intake", { stateType: "started" })])).toBeUndefined();
  });

  it("waits while a chained issue is still in progress", () => {
    expect(pickNext([issue("SR-16", "1. Login", { stateType: "started", labels: ["chain"] }), issue("SR-17", "2. Intake")])).toBeUndefined();
    expect(pickNext([issue("SR-25", "Cleanup", { stateType: "started" }), issue("SR-17", "2. Intake")]).identifier).toBe("SR-17");
  });

  it("does not count a canceled blocker as done, and only picks Lucas's issues", () => {
    expect(pickNext([issue("SR-17", "2. Intake", { blockers: ["canceled"] })])).toBeUndefined();
    expect(pickNext([issue("SR-30", "2. Other", { creatorId: "someone-else" })])).toBeUndefined();
    expect(pickNext([issue("SR-17", "2. Intake", { creatorId: OWNER_ID })]).identifier).toBe("SR-17");
  });

  it("counts a merge only if it happened after the issue last started", () => {
    const merged = [{ title: "SR-16: Login", mergedAt: "2026-11-20T10:00:00Z" }];
    expect([...mergedSince(merged, [{ identifier: "SR-16", startedAt: "2026-11-20T09:00:00Z" }])]).toEqual(["SR-16"]);
    expect([...mergedSince(merged, [{ identifier: "SR-16", startedAt: "2026-11-20T11:00:00Z" }])]).toEqual([]);
  });

  it("returns nothing when every issue is done or blocked", () => {
    expect(pickNext([issue("SR-16", "1. Login", { blockers: ["started"] })])).toBeUndefined();
  });
});

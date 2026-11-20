import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS script without types
import { pickNext } from "../../scripts/chain-next.mjs";

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

  it("returns nothing when every issue is done or blocked", () => {
    expect(pickNext([issue("SR-16", "1. Login", { blockers: ["started"] })])).toBeUndefined();
  });
});

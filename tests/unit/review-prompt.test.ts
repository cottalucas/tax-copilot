import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS script without types
import { findTaskIds, taskSection } from "../../scripts/review-prompt.mjs";

describe("review prompt helpers", () => {
  it("finds Linear task ids in title, body and branch", () => {
    expect(findTaskIds("Fix SR-18", "", "lucas/sr-19-rules")).toEqual(["SR-18", "SR-19"]);
  });

  it("cuts the task section out of TASKS.md", () => {
    const md = "# Tasks\n\n## Task 1: A (SR-16)\nStatus: x\n- [ ] one\n\n## Task 2: B (SR-17)\nStatus: y\n";
    expect(taskSection(md, "SR-16")).toBe("## Task 1: A (SR-16)\nStatus: x\n- [ ] one");
    expect(taskSection(md, "SR-99")).toBe("");
  });
});

describe("review verdict gate", async () => {
  // @ts-expect-error plain JS script without types
  const { parseVerdict } = await import("../../scripts/post-review.mjs");

  it("approves only on an explicit Approve verdict", () => {
    expect(parseVerdict("**Verdict: Approve**\n\nAll good")).toBe("approve");
    expect(parseVerdict("Verdict: Changes requested\n- missing test")).toBe("changes");
    expect(parseVerdict("**Verdict:** Changes requested")).toBe("changes");
  });

  it("fails closed when there is no verdict", () => {
    expect(parseVerdict("Looks fine to me")).toBeNull();
  });
});

describe("review block reasons", async () => {
  // @ts-expect-error plain JS script without types
  const { decide, parseBlockReasons } = await import("../../scripts/post-review.mjs");

  it("reads only the three allowed tags", () => {
    const review = "Verdict: Changes requested\n\nBlock reasons:\n- [NEVER] src/a.ts:3 model call outside src/models\n- [STYLE] docs nit\n- `[SECURITY]` key in .env\n";
    expect(parseBlockReasons(review)).toEqual([
      { tag: "NEVER", text: "src/a.ts:3 model call outside src/models" },
      { tag: "SECURITY", text: "key in .env" },
    ]);
  });

  it("blocks only with a tagged reason", () => {
    expect(decide("**Verdict: Changes requested**\n- [CRITERION] TASKS.md:4 missed").block).toBe(true);
    expect(decide("**Verdict: Changes requested**\n- docs should be in the same pull request").block).toBe(false);
    expect(decide("**Verdict: Approve**\nBlock reasons: None").block).toBe(false);
    expect(decide("no verdict").block).toBe(true);
  });
});

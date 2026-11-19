import { describe, expect, it, vi } from "vitest";
// @ts-expect-error plain JS script without types
import { fetchLinearIssue, findTaskIds } from "../../scripts/review-prompt.mjs";

describe("review prompt helpers", () => {
  it("finds Linear task ids in title, body and branch", () => {
    expect(findTaskIds("Fix SR-18", "", "lucas/sr-19-rules")).toEqual(["SR-18", "SR-19"]);
  });

  it("reads the issue from Linear with the API key", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ data: { issue: { identifier: "SR-24", title: "Gates", description: "- [ ] one" } } })),
    );
    const text = await fetchLinearIssue("SR-24", "key", fetch);
    expect(text).toBe("### SR-24: Gates\n\n- [ ] one");
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.linear.app/graphql");
    expect((init.headers as Record<string, string>).authorization).toBe("key");
    expect(JSON.parse(String(init.body)).variables).toEqual({ id: "SR-24" });
  });

  it("returns nothing without a key or on errors", async () => {
    expect(await fetchLinearIssue("SR-24", "")).toBe("");
    const failing = vi.fn(async () => new Response("no", { status: 401 }));
    expect(await fetchLinearIssue("SR-24", "key", failing)).toBe("");
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

  it("only accepts the verdict as the whole first line", () => {
    expect(parseVerdict("\n\n**Verdict: Approve**\nrest")).toBe("approve");
    expect(parseVerdict("Summary first\nVerdict: Approve")).toBeNull();
    expect(parseVerdict("Verdict: Approve unless the tests fail")).toBeNull();
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

  it("approves, blocks on tagged reasons, fails closed on malformed output", () => {
    expect(decide("**Verdict: Changes requested**\n- [CRITERION] TASKS.md:4 missed").block).toBe(true);
    expect(decide("**Verdict: Changes requested**\n- docs should be in the same pull request").block).toBe(true);
    expect(decide("**Verdict: Changes requested**\n- docs should be in the same pull request").note).toMatch(/Malformed/);
    expect(decide("**Verdict: Approve**\nBlock reasons: None").block).toBe(false);
    expect(decide("no verdict").block).toBe(true);
    expect(decide("**Verdict: Approve**\n- [SECURITY] key in .env").block).toBe(true);
  });
});

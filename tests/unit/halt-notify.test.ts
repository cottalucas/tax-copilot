import { describe, expect, it, vi } from "vitest";
// @ts-expect-error plain JS script without types
import { buildMessage, commentOnLinear } from "../../scripts/halt-notify.mjs";

describe("halt notify", () => {
  it("names the failed jobs and the run", () => {
    const msg = buildMessage({ workflow: "pr", runUrl: "https://run", prNumber: 7, prTitle: "SR-24: gates", failedJobs: ["test:unit", "review"] });
    expect(msg).toContain("Pull request #7 halted. pr failed: test:unit, review.");
    expect(msg).toContain("Run: https://run");
  });

  it("looks up the issue, then creates a comment", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { issue: { id: "uuid-1" } } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { commentCreate: { success: true } } })));
    await commentOnLinear("SR-24", "halted", "key", fetch);
    const calls = fetch.mock.calls as unknown as [string, { body: string; headers: Record<string, string> }][];
    const second = JSON.parse(calls[1]![1].body);
    expect(second.variables).toEqual({ input: { issueId: "uuid-1", body: "halted" } });
    expect(calls[0]![1].headers.authorization).toBe("key");
  });

  it("fails when the issue does not exist", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { issue: null } })));
    await expect(commentOnLinear("SR-999", "x", "key", fetch)).rejects.toThrow(/not found/);
  });
});

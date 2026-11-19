import { describe, expect, it } from "vitest";
import { buildPrompt, MARKER } from "../../scripts/ux-review.js";

describe("ux review", () => {
  it("builds a prompt from the heuristics skill and DESIGN.md", () => {
    const prompt = buildPrompt("H1 Visibility of system status", "Status names: Documents in");
    expect(prompt).toContain("H1 Visibility of system status");
    expect(prompt).toContain("Status names: Documents in");
    expect(prompt).toContain("does not block");
    expect(MARKER).toBe("<!-- tax-copilot-ux-review -->");
  });
});

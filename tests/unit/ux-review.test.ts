import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPrompt, loadShots, MARKER } from "../../scripts/ux-review.js";

describe("ux review", () => {
  it("builds a prompt from the heuristics skill and DESIGN.md", () => {
    const prompt = buildPrompt("H1 Visibility of system status", "Status names: Documents in");
    expect(prompt).toContain("H1 Visibility of system status");
    expect(prompt).toContain("Status names: Documents in");
    expect(prompt).toContain("does not block");
    expect(MARKER).toBe("<!-- tax-copilot-ux-review -->");
  });

  it("loads only real PNG files from the untrusted folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "shots-"));
    writeFileSync(join(dir, "00.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]));
    writeFileSync(join(dir, "01.png"), "not a png");
    writeFileSync(join(dir, "notes.txt"), "ignore");
    const shots = loadShots(dir);
    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatch(/^data:image\/png;base64,/);
  });
});

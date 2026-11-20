import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { modelInputsHash, safeFiles } from "./inputs-hash.js";

function tree() {
  const root = mkdtempSync(join(tmpdir(), "inputs-"));
  for (const d of ["prompts", "src/extraction", "src/models", "src/schema"]) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, "prompts/extraction.md"), "prompt");
  return root;
}

describe("model inputs hash", () => {
  it("is the same from any working directory and changes with the prompt", () => {
    const root = tree();
    const a = modelInputsHash(root);
    expect(modelInputsHash(join(root, "src", ".."))).toBe(a);
    writeFileSync(join(root, "prompts/extraction.md"), "changed");
    expect(modelInputsHash(root)).not.toBe(a);
  });

  it("rejects symlinks, so the trusted host never reads outside the checkout", () => {
    const root = tree();
    symlinkSync("/etc/hosts", join(root, "src/models/link.ts"));
    expect(() => modelInputsHash(root)).toThrow(/Symlink not allowed/);
    expect(() => safeFiles(root, "/etc")).toThrow(/outside the checkout/);
  });

  it("rejects a symlinked parent folder", () => {
    const root = mkdtempSync(join(tmpdir(), "inputs-"));
    const outside = mkdtempSync(join(tmpdir(), "outside-"));
    mkdirSync(join(outside, "models"), { recursive: true });
    writeFileSync(join(outside, "models/x.ts"), "x");
    symlinkSync(outside, join(root, "src"));
    expect(() => safeFiles(root, join(root, "src/models"))).toThrow(/Symlink/);
  });
});

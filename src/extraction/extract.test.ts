import { describe, expect, it } from "vitest";
import type { ModelProvider } from "../models/index.js";
import { extractReturn, loadExtractionPrompt, renderDocuments } from "./extract.js";

const env = { MODEL_PROVIDER: "openrouter", APP_MODEL: "test/model" };

function providerReturning(text: string): ModelProvider {
  return {
    name: "openrouter",
    async complete(req) {
      return { text, provider: "openrouter", model: req.model, latencyMs: 1 };
    },
  };
}

describe("extractReturn", () => {
  it("loads the single prompt source without comments", () => {
    const prompt = loadExtractionPrompt();
    expect(prompt).toContain("source.file");
    expect(prompt).not.toContain("<!--");
  });

  it("renders pages with file and page markers", () => {
    expect(renderDocuments([{ file: "a.pdf", pages: ["one", "two"] }])).toContain('<page file="a.pdf" page="2">');
  });

  it("returns schema valid output", async () => {
    const out = { schemaVersion: 1, taxpayer: { clientId: "c1", taxYear: 2025 } };
    const result = await extractReturn([], {
      env,
      provider: providerReturning(JSON.stringify(out)),
      dataClass: "anonymized",
      clientId: "c1",
      taxYear: 2025,
    });
    expect(result.taxpayer.clientId).toBe("c1");
  });

  it("rejects output that fails the schema", async () => {
    await expect(
      extractReturn([], { env, provider: providerReturning('{"schemaVersion":2}'), dataClass: "anonymized", clientId: "c", taxYear: 2025 }),
    ).rejects.toThrow(/schema/);
  });

  it("rejects non JSON output", async () => {
    await expect(
      extractReturn([], { env, provider: providerReturning("sorry"), dataClass: "anonymized", clientId: "c", taxYear: 2025 }),
    ).rejects.toThrow(/invalid JSON/);
  });
});

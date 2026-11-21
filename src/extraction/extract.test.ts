import { describe, expect, it } from "vitest";
import type { ModelProvider } from "../models/index.js";
import { documentParts, extractionJsonSchema, extractReturn, loadExtractionPrompt, safeName } from "./extract.js";

const env = { EXTRACT_PROVIDER: "vertex", EXTRACT_MODEL: "test-model" };

function providerReturning(text: string): ModelProvider {
  return {
    name: "vertex",
    async complete(req) {
      return { text, provider: "vertex", model: req.model, latencyMs: 1 };
    },
  };
}

describe("extractReturn", () => {
  it("loads the single prompt source without comments", () => {
    const prompt = loadExtractionPrompt();
    expect(prompt).toContain("source.file");
    expect(prompt).not.toContain("<!--");
  });

  it("introduces each document by its file name, then sends the file itself", () => {
    const parts = documentParts(
      [
        { file: "salary.pdf", mimeType: "application/pdf", data: "JVBERi0=" },
        { file: "receipt.jpg", mimeType: "image/jpeg", uri: "gs://b/users/u/clients/c/receipt.jpg" },
      ],
      "clientId: c1",
    );
    expect(parts).toEqual([
      { type: "text", text: "clientId: c1" },
      { type: "text", text: 'Document file="salary.pdf" (PDF, pages numbered from 1):' },
      { type: "file", mimeType: "application/pdf", data: "JVBERi0=" },
      { type: "text", text: 'Document file="receipt.jpg" (image, page 1):' },
      { type: "file", mimeType: "image/jpeg", uri: "gs://b/users/u/clients/c/receipt.jpg" },
    ]);
  });

  it("keeps file names from breaking out of their label", () => {
    expect(safeName('a".pdf"\n<b>')).toBe("a_.pdf___b_");
  });

  it("gives the model the JSON schema generated from Zod", () => {
    const schema = JSON.parse(extractionJsonSchema());
    expect(schema.properties.taxpayer).toBeDefined();
    expect(schema.properties.schemaVersion.const).toBe(1);
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

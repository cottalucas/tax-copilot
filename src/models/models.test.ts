import { describe, expect, it, vi } from "vitest";
import { BudgetExceededError, complete, CostBudget, createProvider, DataResidencyError, getModelConfig, ModelConfigError, priceUsd } from "./index.js";
import type { ModelProvider } from "./index.js";
import { VertexProvider } from "./providers/vertex.js";

const env = { EXTRACT_PROVIDER: "vertex", EXTRACT_MODEL: "gemini-3.1-flash-lite" };

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async (_input: unknown, _init?: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}
const asFetch = (f: ReturnType<typeof fakeFetch>) => f as unknown as typeof globalThis.fetch;
const sent = (f: ReturnType<typeof fakeFetch>, i = 0) => JSON.parse(String((f.mock.calls[i]![1] as RequestInit).body));

const vertexResponse = {
  candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
  usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, cachedContentTokenCount: 400 },
};

function vertex(fetch: ReturnType<typeof fakeFetch>, region = "eu") {
  return new VertexProvider({ projectId: "p", region, fetch: asFetch(fetch), getAccessToken: async () => "token" });
}

describe("getModelConfig", () => {
  it("reads the extract role from variables and defaults to vertex", () => {
    expect(getModelConfig("extract", env)).toEqual({ provider: "vertex", model: "gemini-3.1-flash-lite" });
    expect(getModelConfig("extract", { EXTRACT_MODEL: "m" }).provider).toBe("vertex");
  });

  it("needs the model from a variable and accepts only vertex", () => {
    expect(() => getModelConfig("extract", {})).toThrow(ModelConfigError);
    expect(() => getModelConfig("extract", { EXTRACT_PROVIDER: "openai", EXTRACT_MODEL: "x" })).toThrow(/EXTRACT_PROVIDER/);
  });
});

describe("vertex", () => {
  it("calls the EU multi-region endpoint with keyless auth and prices the call", async () => {
    const fetch = fakeFetch(vertexResponse);
    const result = await complete(
      { dataClass: "anonymized", json: true, maxTokens: 500, messages: [{ role: "system", content: "rules" }, { role: "user", content: "doc" }] },
      { env, provider: vertex(fetch) },
    );
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://aiplatform.eu.rep.googleapis.com/v1/projects/p/locations/eu/publishers/google/models/gemini-3.1-flash-lite:generateContent");
    expect(((init as RequestInit).headers as Record<string, string>).authorization).toBe("Bearer token");
    expect(sent(fetch).systemInstruction).toEqual({ parts: [{ text: "rules" }] });
    expect(sent(fetch).generationConfig).toEqual({ maxOutputTokens: 500, responseMimeType: "application/json" });
    expect(result.text).toBe('{"ok":true}');
    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 200, cachedInputTokens: 400 });
    expect(result.costUsd).toBeCloseTo((600 * 0.275 + 400 * 0.0275 + 200 * 1.65) / 1e6, 12);
  });

  it("uses the regional endpoint for europe-* regions", () => {
    expect(vertex(fakeFetch({}), "europe-west4").url("m")).toBe("https://europe-west4-aiplatform.googleapis.com/v1/projects/p/locations/europe-west4/publishers/google/models/m:generateContent");
  });

  it("sends images as inline data", async () => {
    const fetch = fakeFetch(vertexResponse);
    await complete(
      { dataClass: "anonymized", messages: [{ role: "user", content: [{ type: "text", text: "Read" }, { type: "image", dataUrl: "data:image/png;base64,AA" }] }] },
      { env, provider: vertex(fetch) },
    );
    expect(sent(fetch).contents[0].parts).toEqual([{ text: "Read" }, { inlineData: { mimeType: "image/png", data: "AA" } }]);
  });

  it("refuses non EU locations and surfaces API errors", async () => {
    expect(() => vertex(fakeFetch({}), "us-central1")).toThrow(DataResidencyError);
    expect(() => vertex(fakeFetch({}), "global")).toThrow(DataResidencyError);
    await expect(complete({ dataClass: "anonymized", messages: [] }, { env, provider: vertex(fakeFetch({ error: { message: "denied" } }, 403)) })).rejects.toThrow(/403: denied/);
  });

  it("is built from env and fails clearly without its settings", () => {
    expect(createProvider("vertex", { VERTEX_PROJECT_ID: "p", VERTEX_REGION: "eu" }).name).toBe("vertex");
    expect(() => createProvider("vertex", {})).toThrow(/VERTEX_PROJECT_ID/);
  });

  it("uses Google Application Default Credentials when no token function is given", async () => {
    vi.resetModules();
    vi.doMock("google-auth-library", () => ({
      GoogleAuth: class {
        async getClient() {
          return { getAccessToken: async () => ({ token: "adc-token" }) };
        }
      },
    }));
    const { VertexProvider: Fresh } = await import("./providers/vertex.js");
    const fetch = fakeFetch(vertexResponse);
    await new Fresh({ projectId: "p", region: "eu", fetch: asFetch(fetch) }).complete({ dataClass: "anonymized", messages: [], model: "m" });
    expect(((fetch.mock.calls[0]![1] as RequestInit).headers as Record<string, string>).authorization).toBe("Bearer adc-token");
    vi.doUnmock("google-auth-library");
  });
});

describe("data residency", () => {
  it("refuses client data for any provider outside the EU allow list", async () => {
    const other = { name: "other", complete: vi.fn() } as unknown as ModelProvider;
    await expect(complete({ dataClass: "client", messages: [] }, { env, provider: other })).rejects.toThrow(DataResidencyError);
    expect(other.complete).not.toHaveBeenCalled();
  });

  it("accepts client data on vertex", async () => {
    const result = await complete({ dataClass: "client", messages: [] }, { env, provider: vertex(fakeFetch(vertexResponse)) });
    expect(result.provider).toBe("vertex");
  });
});

describe("cost and budget", () => {
  it("prices from config and returns undefined without a price row", () => {
    expect(priceUsd("vertex", "gemini-3.1-flash-lite", { inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(0.275);
    expect(priceUsd("vertex", "unknown-model", { inputTokens: 1, outputTokens: 1 })).toBeUndefined();
  });

  it("fails the run when spend or calls pass the budget", () => {
    const budget = new CostBudget(1);
    budget.record({ model: "m", costUsd: 0.6 });
    expect(() => budget.record({ model: "m", costUsd: 0.6 })).toThrow(BudgetExceededError);
    const calls = new CostBudget(1, { maxCalls: 1 });
    calls.record({ model: "m", costUsd: 0 });
    expect(() => calls.record({ model: "m", costUsd: 0 })).toThrow(/calls/);
  });

  it("fails on unknown cost when the run requires it, counts it otherwise", () => {
    expect(() => new CostBudget(1, { requireCost: true }).record({ model: "m" })).toThrow(BudgetExceededError);
    const budget = new CostBudget(1);
    budget.record({ model: "m" });
    expect(budget.unknownCostCalls).toBe(1);
    expect(() => new CostBudget(0)).toThrow();
  });
});

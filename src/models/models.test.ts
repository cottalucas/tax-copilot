import { describe, expect, it, vi } from "vitest";
import { BudgetExceededError, complete, CostBudget, DataResidencyError, getModelConfig, ModelConfigError, priceUsd } from "./index.js";
import { AnthropicProvider, ANTHROPIC_URL } from "./providers/anthropic.js";
import { OPENAI_BASE_URL, OPENROUTER_BASE_URL, OpenAICompatibleProvider } from "./providers/openai.js";
import { VertexProvider } from "./providers/vertex.js";

const env = { EXTRACT_PROVIDER: "vertex", EXTRACT_MODEL: "gemini-3.1-flash-lite", CHECK_PROVIDER: "openai", CHECK_MODEL: "test-check" };

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
const chatResponse = {
  id: "c1",
  object: "chat.completion",
  created: 0,
  model: "test-check",
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Verdict: Approve" } }],
  usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15, prompt_tokens_details: { cached_tokens: 8 } },
};

function vertex(fetch: ReturnType<typeof fakeFetch>, region = "europe-west4") {
  return new VertexProvider({ projectId: "p", region, fetch: asFetch(fetch), getAccessToken: async () => "token" });
}

describe("getModelConfig", () => {
  it("reads provider and model per role", () => {
    expect(getModelConfig("extract", env)).toEqual({ provider: "vertex", model: "gemini-3.1-flash-lite" });
    expect(getModelConfig("check", env)).toEqual({ provider: "openai", model: "test-check" });
  });

  it("defaults the provider to vertex", () => {
    expect(getModelConfig("extract", { EXTRACT_MODEL: "m" }).provider).toBe("vertex");
  });

  it("needs the model from a variable and rejects unknown providers", () => {
    expect(() => getModelConfig("extract", {})).toThrow(ModelConfigError);
    expect(() => getModelConfig("check", { CHECK_PROVIDER: "other", CHECK_MODEL: "x" })).toThrow(/CHECK_PROVIDER/);
  });
});

describe("vertex", () => {
  it("calls the regional endpoint with keyless auth and prices the call", async () => {
    const fetch = fakeFetch(vertexResponse);
    const result = await complete(
      { dataClass: "anonymized", json: true, maxTokens: 500, messages: [{ role: "system", content: "rules" }, { role: "user", content: "doc" }] },
      { env, provider: vertex(fetch) },
    );
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://europe-west4-aiplatform.googleapis.com/v1/projects/p/locations/europe-west4/publishers/google/models/gemini-3.1-flash-lite:generateContent");
    expect(((init as RequestInit).headers as Record<string, string>).authorization).toBe("Bearer token");
    const body = sent(fetch);
    expect(body.systemInstruction).toEqual({ parts: [{ text: "rules" }] });
    expect(body.generationConfig).toEqual({ maxOutputTokens: 500, responseMimeType: "application/json" });
    expect(result.text).toBe('{"ok":true}');
    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 200, cachedInputTokens: 400 });
    // 600 fresh x 0.275 + 400 cached x 0.0275 + 200 out x 1.65, per 1M tokens
    expect(result.costUsd).toBeCloseTo((600 * 0.275 + 400 * 0.0275 + 200 * 1.65) / 1e6, 12);
  });

  it("sends images as inline data", async () => {
    const fetch = fakeFetch(vertexResponse);
    await complete(
      { dataClass: "anonymized", messages: [{ role: "user", content: [{ type: "text", text: "Review" }, { type: "image", dataUrl: "data:image/png;base64,AA" }] }] },
      { env, provider: vertex(fetch) },
    );
    expect(sent(fetch).contents[0].parts).toEqual([{ text: "Review" }, { inlineData: { mimeType: "image/png", data: "AA" } }]);
  });

  it("uses the EU multi-region endpoint for eu", () => {
    expect(vertex(fakeFetch({}), "eu").url("m")).toBe("https://aiplatform.eu.rep.googleapis.com/v1/projects/p/locations/eu/publishers/google/models/m:generateContent");
  });

  it("only accepts EU locations and surfaces API errors", async () => {
    expect(() => vertex(fakeFetch({}), "us-central1")).toThrow(DataResidencyError);
    expect(() => vertex(fakeFetch({}), "global")).toThrow(DataResidencyError);
    await expect(complete({ dataClass: "anonymized", messages: [] }, { env, provider: vertex(fakeFetch({ error: { message: "denied" } }, 403)) })).rejects.toThrow(/403: denied/);
  });

  it("accepts client data, unlike every other provider", async () => {
    const result = await complete({ dataClass: "client", messages: [] }, { env, provider: vertex(fakeFetch(vertexResponse)) });
    expect(result.provider).toBe("vertex");
  });
});

describe("openai and openrouter", () => {
  it("calls OpenAI for the check role and reads cached tokens", async () => {
    const fetch = fakeFetch(chatResponse);
    const provider = new OpenAICompatibleProvider({ name: "openai", apiKey: "k", fetch: asFetch(fetch) });
    const result = await complete({ role: "check", dataClass: "anonymized", maxTokens: 100, messages: [{ role: "user", content: "hi" }] }, { env, provider });
    expect(String(fetch.mock.calls[0]![0])).toBe(`${OPENAI_BASE_URL}/chat/completions`);
    expect(sent(fetch).model).toBe("test-check");
    expect(sent(fetch).max_completion_tokens).toBe(100);
    expect(sent(fetch)).not.toHaveProperty("temperature");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3, cachedInputTokens: 8 });
    expect(result.costUsd).toBeUndefined(); // no price row for this test model
  });

  it("asks OpenRouter for the cost and uses it", async () => {
    const fetch = fakeFetch({ ...chatResponse, usage: { ...chatResponse.usage, cost: 0.0042 } });
    const provider = new OpenAICompatibleProvider({ name: "openrouter", apiKey: "k", fetch: asFetch(fetch) });
    const result = await complete({ dataClass: "anonymized", messages: [] }, { env, provider });
    expect(String(fetch.mock.calls[0]![0])).toBe(`${OPENROUTER_BASE_URL}/chat/completions`);
    expect(sent(fetch).usage).toEqual({ include: true });
    expect(result.costUsd).toBe(0.0042);
  });

  it("needs keys from secrets", () => {
    expect(() => OpenAICompatibleProvider.openai({})).toThrow(/OPENAI_API_KEY/);
    expect(() => OpenAICompatibleProvider.openrouter({})).toThrow(/OPENROUTER_API_KEY/);
  });
});

describe("anthropic", () => {
  it("marks the system prompt for caching and counts cached tokens", async () => {
    const fetch = fakeFetch({
      model: "test-claude",
      content: [{ type: "text", text: "done" }],
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 },
    });
    const provider = new AnthropicProvider("k", asFetch(fetch));
    const result = await complete({ role: "check", dataClass: "anonymized", messages: [{ role: "system", content: "rules" }, { role: "user", content: "diff" }] }, { env: { CHECK_PROVIDER: "anthropic", CHECK_MODEL: "test-claude" }, provider });
    expect(String(fetch.mock.calls[0]![0])).toBe(ANTHROPIC_URL);
    expect(sent(fetch).system).toEqual([{ type: "text", text: "rules", cache_control: { type: "ephemeral" } }]);
    expect(sent(fetch).messages).toEqual([{ role: "user", content: "diff" }]);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 5, cachedInputTokens: 90 });
    expect(() => AnthropicProvider.fromEnv({})).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("data residency", () => {
  it("refuses client data for every provider except vertex", async () => {
    const fetch = fakeFetch(chatResponse);
    const provider = new OpenAICompatibleProvider({ name: "openai", apiKey: "k", fetch: asFetch(fetch) });
    await expect(complete({ dataClass: "client", messages: [] }, { env, provider })).rejects.toThrow(DataResidencyError);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("cost and budget", () => {
  it("prices from config and returns undefined without a price row", () => {
    expect(priceUsd("vertex", "gemini-3.1-flash-lite", { inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(0.275);
    expect(priceUsd("vertex", "unknown-model", { inputTokens: 1, outputTokens: 1 })).toBeUndefined();
  });

  it("fails the run when spend passes the budget", async () => {
    const fetch = fakeFetch({ ...chatResponse, usage: { ...chatResponse.usage, cost: 0.6 } });
    const provider = new OpenAICompatibleProvider({ name: "openrouter", apiKey: "k", fetch: asFetch(fetch) });
    const budget = new CostBudget(1);
    await complete({ dataClass: "anonymized", messages: [] }, { env, provider, budget });
    await expect(complete({ dataClass: "anonymized", messages: [] }, { env, provider, budget })).rejects.toThrow(BudgetExceededError);
  });

  it("fails on unknown cost when the run requires it, counts it otherwise", () => {
    expect(() => new CostBudget(1, { requireCost: true }).record({ model: "m" })).toThrow(BudgetExceededError);
    const budget = new CostBudget(1);
    budget.record({ model: "m" });
    expect(budget.unknownCostCalls).toBe(1);
    expect(() => new CostBudget(0)).toThrow();
  });
});

describe("provider factory and keyless login", () => {
  it("builds each provider from env and fails clearly without its settings", async () => {
    const { createProvider } = await import("./index.js");
    const full = { VERTEX_PROJECT_ID: "p", VERTEX_REGION: "europe-west4", OPENAI_API_KEY: "k", ANTHROPIC_API_KEY: "k", OPENROUTER_API_KEY: "k" };
    expect(createProvider("vertex", full).name).toBe("vertex");
    expect(createProvider("openai", full).name).toBe("openai");
    expect(createProvider("anthropic", full).name).toBe("anthropic");
    expect(createProvider("openrouter", full).name).toBe("openrouter");
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
    await new Fresh({ projectId: "p", region: "europe-west4", fetch: asFetch(fetch) }).complete({ dataClass: "anonymized", messages: [], model: "m" });
    expect(((fetch.mock.calls[0]![1] as RequestInit).headers as Record<string, string>).authorization).toBe("Bearer adc-token");
    vi.doUnmock("google-auth-library");
  });

  it("sends images to Anthropic and OpenAI in their own formats", async () => {
    const image = { role: "user" as const, content: [{ type: "text" as const, text: "Look" }, { type: "image" as const, dataUrl: "data:image/png;base64,AA" }] };
    const a = fakeFetch({ content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 } });
    await new AnthropicProvider("k", asFetch(a)).complete({ dataClass: "anonymized", messages: [{ role: "system", content: [{ type: "text", text: "sys" }] }, image], model: "m" });
    expect(sent(a).messages[0].content[1]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "AA" } });
    expect(sent(a).system[0].text).toBe("sys");
    const o = fakeFetch(chatResponse);
    await new OpenAICompatibleProvider({ name: "openai", apiKey: "k", fetch: asFetch(o) }).complete({ dataClass: "anonymized", messages: [image], model: "m" });
    expect(sent(o).messages[0].content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AA" } });
  });

  it("surfaces Anthropic errors", async () => {
    const a = fakeFetch({ error: { message: "overloaded" } }, 529);
    await expect(new AnthropicProvider("k", asFetch(a)).complete({ dataClass: "anonymized", messages: [], model: "m" })).rejects.toThrow(/529: overloaded/);
  });
});

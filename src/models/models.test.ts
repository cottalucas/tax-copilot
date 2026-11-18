import { describe, expect, it, vi } from "vitest";
import { complete, DataResidencyError, getModelConfig, ModelConfigError } from "./index.js";
import { OPENROUTER_BASE_URL, OpenRouterProvider } from "./providers/openrouter.js";
import { VertexProvider } from "./providers/vertex.js";

const env = { MODEL_PROVIDER: "openrouter", APP_MODEL: "test/model-a", OPENROUTER_API_KEY: "test-key" };

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async (_input: unknown, _init?: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

const chatResponse = {
  id: "cmpl-1",
  object: "chat.completion",
  created: 0,
  model: "test/model-a",
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: '{"ok":true}' } }],
  usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
};

describe("getModelConfig", () => {
  it("reads provider and model from variables", () => {
    expect(getModelConfig(env)).toEqual({ provider: "openrouter", model: "test/model-a" });
  });

  it("fails clearly when APP_MODEL is missing", () => {
    expect(() => getModelConfig({ MODEL_PROVIDER: "openrouter" })).toThrow(ModelConfigError);
  });

  it("rejects unknown providers", () => {
    expect(() => getModelConfig({ MODEL_PROVIDER: "other", APP_MODEL: "x" })).toThrow(/MODEL_PROVIDER/);
  });
});

describe("OpenRouterProvider", () => {
  it("calls the OpenAI compatible endpoint with the configured model", async () => {
    const fetch = fakeFetch(chatResponse);
    const provider = new OpenRouterProvider({ apiKey: "test-key", fetch: fetch as unknown as typeof globalThis.fetch });

    const result = await complete(
      { messages: [{ role: "user", content: "hi" }], dataClass: "anonymized", json: true },
      { env, provider },
    );

    expect(result).toMatchObject({ text: '{"ok":true}', provider: "openrouter", model: "test/model-a" });
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3 });
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe(`${OPENROUTER_BASE_URL}/chat/completions`);
    const sent = JSON.parse(String((init as RequestInit).body));
    expect(sent.model).toBe("test/model-a");
    expect(sent.response_format).toEqual({ type: "json_object" });
    expect(sent).not.toHaveProperty("temperature");
  });

  it("lets evals override the model per call", async () => {
    const fetch = fakeFetch({ ...chatResponse, model: "test/model-b" });
    const provider = new OpenRouterProvider({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    await complete({ messages: [], dataClass: "anonymized", model: "test/model-b" }, { env, provider });
    expect(JSON.parse(String((fetch.mock.calls[0]![1] as RequestInit).body)).model).toBe("test/model-b");
  });

  it("surfaces provider errors", async () => {
    const fetch = fakeFetch({ error: { message: "bad key" } }, 401);
    const provider = new OpenRouterProvider({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(complete({ messages: [], dataClass: "anonymized" }, { env, provider })).rejects.toThrow();
  });

  it("needs OPENROUTER_API_KEY from secrets", () => {
    expect(() => OpenRouterProvider.fromEnv({})).toThrow(/OPENROUTER_API_KEY/);
  });
});

describe("data residency", () => {
  it("refuses to send client data to OpenRouter", async () => {
    const fetch = fakeFetch(chatResponse);
    const provider = new OpenRouterProvider({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(
      complete({ messages: [{ role: "user", content: "x" }], dataClass: "client" }, { env, provider }),
    ).rejects.toThrow(DataResidencyError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("only accepts EU regions for Vertex", () => {
    expect(() => new VertexProvider({ projectId: "p", region: "us-central1" })).toThrow(DataResidencyError);
    expect(new VertexProvider({ projectId: "p", region: "europe-west6" }).region).toBe("europe-west6");
  });

  it("vertex stub fails loudly until implemented", async () => {
    const provider = new VertexProvider({ projectId: "p", region: "europe-west6" });
    await expect(
      complete(
        { messages: [], dataClass: "client" },
        { env: { MODEL_PROVIDER: "vertex", APP_MODEL: "m" }, provider },
      ),
    ).rejects.toThrow(/stub/);
  });
});

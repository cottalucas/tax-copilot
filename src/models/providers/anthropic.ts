import { requireEnv } from "../config.js";
import { priceUsd } from "../prices.js";
import type { ChatMessage, CompletionRequest, CompletionResult, ContentPart, ModelProvider } from "../types.js";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MAX_TOKENS = 4096;

/** Anthropic Messages API. The system prompt is marked for prompt caching. */
export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof globalThis.fetch) {
    return new AnthropicProvider(requireEnv(env, "ANTHROPIC_API_KEY"), fetchImpl);
  }

  async complete(request: CompletionRequest & { model: string }): Promise<CompletionResult> {
    const started = Date.now();
    const system = request.messages.filter((m) => m.role === "system").map((m) => textOf(m.content)).join("\n\n");
    const body = {
      model: request.model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(system ? { system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] } : {}),
      messages: request.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: toParts(m.content) })),
    };
    const res = await this.fetchImpl(ANTHROPIC_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      model?: string;
      usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${json.error?.message ?? "unknown"}`);
    const cached = json.usage?.cache_read_input_tokens ?? 0;
    const usage = json.usage
      ? {
          inputTokens: json.usage.input_tokens + cached + (json.usage.cache_creation_input_tokens ?? 0),
          outputTokens: json.usage.output_tokens,
          cachedInputTokens: cached,
        }
      : undefined;
    return {
      text: (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join(""),
      provider: this.name,
      model: json.model ?? request.model,
      latencyMs: Date.now() - started,
      usage,
      costUsd: priceUsd(this.name, request.model, usage),
    };
  }
}

function textOf(content: ChatMessage["content"]): string {
  return typeof content === "string" ? content : content.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n");
}

function toParts(content: ChatMessage["content"]) {
  if (typeof content === "string") return content;
  return content.map((p: ContentPart) => {
    if (p.type === "text") return { type: "text", text: p.text };
    const [, mediaType = "image/png", data = ""] = /^data:([^;]+);base64,(.*)$/.exec(p.dataUrl) ?? [];
    return { type: "image", source: { type: "base64", media_type: mediaType, data } };
  });
}

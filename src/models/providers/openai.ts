import OpenAI from "openai";
import { requireEnv } from "../config.js";
import { priceUsd } from "../prices.js";
import type { ChatMessage, CompletionRequest, CompletionResult, ModelProvider } from "../types.js";

export const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface OpenAICompatibleOptions {
  name: "openai" | "openrouter";
  apiKey: string;
  baseURL?: string;
  /** Injected in tests to mock the network. */
  fetch?: typeof globalThis.fetch;
}

/**
 * OpenAI and OpenRouter share one OpenAI compatible client. OpenAI caches long stable prompt
 * prefixes on its own. OpenRouter reports cost per call. Neither sees real client data.
 */
export class OpenAICompatibleProvider implements ModelProvider {
  readonly name: "openai" | "openrouter";
  private readonly client: OpenAI;

  constructor(options: OpenAICompatibleOptions) {
    this.name = options.name;
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL ?? (options.name === "openai" ? OPENAI_BASE_URL : OPENROUTER_BASE_URL),
      fetch: options.fetch,
      maxRetries: 0,
    });
  }

  static openai(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof globalThis.fetch) {
    return new OpenAICompatibleProvider({ name: "openai", apiKey: requireEnv(env, "OPENAI_API_KEY"), fetch: fetchImpl });
  }

  static openrouter(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof globalThis.fetch) {
    return new OpenAICompatibleProvider({ name: "openrouter", apiKey: requireEnv(env, "OPENROUTER_API_KEY"), fetch: fetchImpl });
  }

  async complete(request: CompletionRequest & { model: string }): Promise<CompletionResult> {
    const started = Date.now();
    // Only pass what the request sets. Some models reject sampling parameters.
    const body = {
      model: request.model,
      messages: request.messages.map(toOpenAIMessage),
      ...(this.name === "openrouter" ? { usage: { include: true } } : {}),
      ...(request.maxTokens ? { [this.name === "openai" ? "max_completion_tokens" : "max_tokens"]: request.maxTokens } : {}),
      ...(request.json ? { response_format: { type: "json_object" as const } } : {}),
    };
    const response = (await this.client.chat.completions.create(
      body as unknown as Parameters<typeof this.client.chat.completions.create>[0],
    )) as OpenAI.Chat.Completions.ChatCompletion;
    const u = response.usage as
      | (OpenAI.CompletionUsage & { cost?: unknown; prompt_tokens_details?: { cached_tokens?: number } })
      | undefined;
    const usage = u
      ? { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens, cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? 0 }
      : undefined;
    const model = response.model || request.model;
    const reported = typeof u?.cost === "number" && Number.isFinite(u.cost) ? u.cost : undefined;
    return {
      text: response.choices[0]?.message?.content ?? "",
      provider: this.name,
      model,
      latencyMs: Date.now() - started,
      usage,
      costUsd: reported ?? priceUsd(this.name, request.model, usage),
    };
  }
}

function toOpenAIMessage(message: ChatMessage) {
  if (typeof message.content === "string") return message;
  return {
    role: message.role,
    content: message.content.map((part) =>
      part.type === "text"
        ? { type: "text" as const, text: part.text }
        : { type: "image_url" as const, image_url: { url: part.dataUrl } },
    ),
  };
}

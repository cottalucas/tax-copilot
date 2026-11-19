import OpenAI from "openai";
import { requireEnv } from "../config.js";
import type { ChatMessage, CompletionRequest, CompletionResult, ModelProvider } from "../types.js";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface OpenRouterOptions {
  apiKey: string;
  /** Injected in tests to mock the network. */
  fetch?: typeof globalThis.fetch;
  baseURL?: string;
}

/**
 * OpenRouter through its OpenAI compatible endpoint.
 * Dev and anonymized evals only. Never real client data (AGENTS.md > Never do).
 */
export class OpenRouterProvider implements ModelProvider {
  readonly name = "openrouter" as const;
  private readonly client: OpenAI;

  constructor(options: OpenRouterOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL ?? OPENROUTER_BASE_URL,
      fetch: options.fetch,
      maxRetries: 0,
    });
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof globalThis.fetch): OpenRouterProvider {
    return new OpenRouterProvider({ apiKey: requireEnv(env, "OPENROUTER_API_KEY"), fetch: fetchImpl });
  }

  async complete(request: CompletionRequest & { model: string }): Promise<CompletionResult> {
    const started = Date.now();
    // Only pass what the request sets. Some models reject sampling parameters.
    // `usage.include` asks OpenRouter to return the cost of the call (budgets.json).
    const body = {
      model: request.model,
      messages: request.messages.map(toOpenAIMessage),
      usage: { include: true },
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
      ...(request.json ? { response_format: { type: "json_object" as const } } : {}),
    };
    const response = await this.client.chat.completions.create(
      body as unknown as Parameters<typeof this.client.chat.completions.create>[0],
    ) as OpenAI.Chat.Completions.ChatCompletion;
    const text = response.choices[0]?.message?.content ?? "";
    return {
      text,
      provider: this.name,
      model: response.model || request.model,
      latencyMs: Date.now() - started,
      usage: response.usage
        ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
        : undefined,
      costUsd: readCost(response.usage),
    };
  }
}

function readCost(usage: unknown): number | undefined {
  const cost = (usage as { cost?: unknown } | undefined)?.cost;
  return typeof cost === "number" && Number.isFinite(cost) ? cost : undefined;
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

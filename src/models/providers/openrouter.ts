import OpenAI from "openai";
import { requireEnv } from "../config.js";
import type { CompletionRequest, CompletionResult, ModelProvider } from "../types.js";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface OpenRouterOptions {
  apiKey: string;
  /** Injected in tests to mock the network. */
  fetch?: typeof globalThis.fetch;
  baseURL?: string;
}

/**
 * OpenRouter through its OpenAI compatible endpoint.
 * Dev and anonymized evals only. Never real client data (SECURITY.md).
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
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
      ...(request.json ? { response_format: { type: "json_object" as const } } : {}),
    });
    const text = response.choices[0]?.message?.content ?? "";
    return {
      text,
      provider: this.name,
      model: response.model || request.model,
      latencyMs: Date.now() - started,
      usage: response.usage
        ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
        : undefined,
    };
  }
}

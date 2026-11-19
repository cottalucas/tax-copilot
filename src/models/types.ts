export type Role = "system" | "user" | "assistant";

export type ContentPart = { type: "text"; text: string } | { type: "image"; dataUrl: string };

export interface ChatMessage {
  role: Role;
  /** Plain text, or parts with images (data URLs). Images only of synthetic or app screens. */
  content: string | ContentPart[];
}

/**
 * What kind of data a call carries. Decides which providers may receive it.
 * - "anonymized": synthetic or anonymized data. Any provider.
 * - "client": real client data. Only vertex in an EU region (final residency decided at SR-18).
 */
export type DataClass = "anonymized" | "client";

/** Which job the call does. Each role has its own provider and model variables. */
export type ModelRole = "extract" | "check";

export interface CompletionRequest {
  messages: ChatMessage[];
  dataClass: DataClass;
  /** Picks EXTRACT_* or CHECK_* variables. Default "extract". */
  role?: ModelRole;
  /** Ask the provider for a JSON object response. */
  json?: boolean;
  maxTokens?: number;
  /** Overrides the role's model for this call. Used by evals to compare models. */
  model?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  /** Input tokens served from the provider's prompt cache. */
  cachedInputTokens?: number;
}

export interface CompletionResult {
  text: string;
  provider: ProviderName;
  model: string;
  latencyMs: number;
  usage?: Usage;
  /** Cost in USD: reported by the provider (OpenRouter) or priced from config/model-prices.json. */
  costUsd?: number;
}

export type ProviderName = "vertex" | "anthropic" | "openai" | "openrouter";

export interface ModelProvider {
  readonly name: ProviderName;
  complete(request: CompletionRequest & { model: string }): Promise<CompletionResult>;
}

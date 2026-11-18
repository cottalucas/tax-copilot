export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

/**
 * What kind of data a call carries. Decides which providers may receive it.
 * - "anonymized": synthetic or anonymized data. Any provider.
 * - "client": real client data. Only an EU region locked provider (vertex).
 */
export type DataClass = "anonymized" | "client";

export interface CompletionRequest {
  messages: ChatMessage[];
  dataClass: DataClass;
  /** Ask the provider for a JSON object response. */
  json?: boolean;
  maxTokens?: number;
  /** Overrides APP_MODEL for this call. Used by evals to compare models. */
  model?: string;
}

export interface CompletionResult {
  text: string;
  provider: ProviderName;
  model: string;
  latencyMs: number;
  usage?: { inputTokens: number; outputTokens: number };
}

export type ProviderName = "openrouter" | "vertex";

export interface ModelProvider {
  readonly name: ProviderName;
  complete(request: CompletionRequest & { model: string }): Promise<CompletionResult>;
}

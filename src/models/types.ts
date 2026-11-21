export type Role = "system" | "user" | "assistant";

/**
 * A document for the model to read itself (PDF, JPG, PNG): inline bytes (base64) for small
 * synthetic files, or a gs:// link to a file in the project's EU bucket.
 */
export type FilePart = { type: "file"; mimeType: string } & ({ data: string; uri?: never } | { uri: string; data?: never });

export type ContentPart = { type: "text"; text: string } | { type: "image"; dataUrl: string } | FilePart;

export interface ChatMessage {
  role: Role;
  /** Plain text, or parts with images (data URLs). Images only of synthetic or app screens. */
  content: string | ContentPart[];
}

/**
 * What kind of data a call carries.
 * - "anonymized": synthetic or anonymized data.
 * - "client": real client data. Only vertex on an EU endpoint (decided by Lucas, 2026-11-21).
 */
export type DataClass = "anonymized" | "client";

/** Which job the call does. Product AI has one role today: extract (EXTRACT_* variables). */
export type ModelRole = "extract";

export interface CompletionRequest {
  messages: ChatMessage[];
  dataClass: DataClass;
  /** Picks the role's variables. Only "extract" today. */
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
  /** Cost in USD, priced from config/model-prices.json. */
  costUsd?: number;
}

/** Product AI providers. Vertex only today. New providers implement ModelProvider. */
export type ProviderName = "vertex";

export interface ModelProvider {
  readonly name: ProviderName;
  complete(request: CompletionRequest & { model: string }): Promise<CompletionResult>;
}

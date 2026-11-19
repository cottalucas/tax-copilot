import type { CostBudget } from "./budget.js";
import { getModelConfig } from "./config.js";
import { DataResidencyError } from "./errors.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAICompatibleProvider } from "./providers/openai.js";
import { VertexProvider } from "./providers/vertex.js";
import type { CompletionRequest, CompletionResult, ModelProvider, ProviderName } from "./types.js";

export * from "./types.js";
export * from "./errors.js";
export { getModelConfig } from "./config.js";
export { CostBudget } from "./budget.js";
export { priceUsd } from "./prices.js";

export interface AdapterDeps {
  env?: NodeJS.ProcessEnv;
  /** Injected in tests. Defaults to building the provider from env. */
  provider?: ModelProvider;
  /** Caps spend for the run this call belongs to. */
  budget?: CostBudget;
}

/** Providers allowed to receive real client data: EU region locked only (decided at SR-18). */
const CLIENT_DATA_PROVIDERS: readonly ProviderName[] = ["vertex"];

export function createProvider(name: ProviderName, env: NodeJS.ProcessEnv = process.env): ModelProvider {
  switch (name) {
    case "vertex":
      return VertexProvider.fromEnv(env);
    case "anthropic":
      return AnthropicProvider.fromEnv(env);
    case "openai":
      return OpenAICompatibleProvider.openai(env);
    case "openrouter":
      return OpenAICompatibleProvider.openrouter(env);
  }
}

/**
 * The one entry point for every model call in this repo (AGENTS.md).
 * Provider and model come from the role's variables (EXTRACT_* or CHECK_*).
 * Refuses to send client data to any provider outside the EU allow list.
 */
export async function complete(request: CompletionRequest, deps: AdapterDeps = {}): Promise<CompletionResult> {
  const env = deps.env ?? process.env;
  const config = getModelConfig(request.role ?? "extract", env);
  const provider = deps.provider ?? createProvider(config.provider, env);

  if (request.dataClass === "client" && !CLIENT_DATA_PROVIDERS.includes(provider.name)) {
    throw new DataResidencyError(
      `Client data may only go to ${CLIENT_DATA_PROVIDERS.join(", ")}. Provider "${provider.name}" refused.`,
    );
  }

  const result = await provider.complete({ ...request, model: request.model ?? config.model });
  deps.budget?.record(result);
  return result;
}

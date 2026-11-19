import { ModelConfigError } from "./errors.js";
import type { ModelRole, ProviderName } from "./types.js";

export interface ModelConfig {
  provider: ProviderName;
  model: string;
}

export const PROVIDERS: readonly ProviderName[] = ["vertex", "anthropic", "openai", "openrouter"];
export const DEFAULT_PROVIDER: ProviderName = "vertex";

/**
 * Reads provider and model for a role from variables: EXTRACT_PROVIDER and EXTRACT_MODEL, or
 * CHECK_PROVIDER and CHECK_MODEL. Provider defaults to vertex. The model always comes from a
 * variable: never a model name in code (AGENTS.md). Switching is a variable change only.
 */
export function getModelConfig(role: ModelRole = "extract", env: NodeJS.ProcessEnv = process.env): ModelConfig {
  const prefix = role.toUpperCase();
  const raw = (env[`${prefix}_PROVIDER`] ?? "").trim();
  const provider = (raw || DEFAULT_PROVIDER) as ProviderName;
  if (!PROVIDERS.includes(provider)) {
    throw new ModelConfigError(`${prefix}_PROVIDER must be one of ${PROVIDERS.join(", ")}. Got "${raw}".`);
  }
  const model = (env[`${prefix}_MODEL`] ?? "").trim();
  if (!model) {
    throw new ModelConfigError(`${prefix}_MODEL is not set. Set it as a repository variable or in .env.`);
  }
  return { provider, model };
}

export function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = (env[name] ?? "").trim();
  if (!value) {
    throw new ModelConfigError(`${name} is not set. A human sets it (AGENTS.md > Secrets and variables).`);
  }
  return value;
}

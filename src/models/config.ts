import { ModelConfigError } from "./errors.js";
import type { ProviderName } from "./types.js";

export interface ModelConfig {
  provider: ProviderName;
  model: string;
}

const PROVIDERS: readonly ProviderName[] = ["openrouter", "vertex"];

/**
 * Reads provider and model from variables. Never hardcode a model name (AGENTS.md).
 */
export function getModelConfig(env: NodeJS.ProcessEnv = process.env): ModelConfig {
  const provider = (env.MODEL_PROVIDER ?? "").trim() as ProviderName;
  if (!PROVIDERS.includes(provider)) {
    throw new ModelConfigError(
      `MODEL_PROVIDER must be one of ${PROVIDERS.join(", ")}. Got "${env.MODEL_PROVIDER ?? ""}".`,
    );
  }
  const model = (env.APP_MODEL ?? "").trim();
  if (!model) {
    throw new ModelConfigError("APP_MODEL is not set. Set it as a repository variable or in .env.");
  }
  return { provider, model };
}

export function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = (env[name] ?? "").trim();
  if (!value) {
    throw new ModelConfigError(`${name} is not set. A human sets it as a secret (AGENTS.md > Secrets and variables).`);
  }
  return value;
}

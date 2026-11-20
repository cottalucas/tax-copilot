import prices from "../../config/model-prices.json" with { type: "json" };
import type { ProviderName, Usage } from "./types.js";

type Price = { input: number; cachedInput?: number; output: number };
const table = prices as unknown as Partial<Record<ProviderName, Record<string, Price>>>;

/** Prices a call from config/model-prices.json. Returns undefined when the model has no price. */
export function priceUsd(provider: ProviderName, model: string, usage: Usage | undefined): number | undefined {
  const price = table[provider]?.[model];
  if (!price || !usage) return undefined;
  const cached = usage.cachedInputTokens ?? 0;
  const fresh = Math.max(0, usage.inputTokens - cached);
  const perToken = (usd: number) => usd / 1_000_000;
  return fresh * perToken(price.input) + cached * perToken(price.cachedInput ?? price.input) + usage.outputTokens * perToken(price.output);
}

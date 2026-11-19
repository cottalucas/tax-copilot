import { BudgetExceededError } from "./errors.js";
import type { CompletionResult } from "./types.js";

/**
 * Caps model spend for one run (an eval run, a batch extraction). Fails when the cap is passed.
 * Calls whose cost the provider does not report are counted, so a run can be audited.
 */
export class CostBudget {
  spentUsd = 0;
  calls = 0;
  unknownCostCalls = 0;

  constructor(readonly maxUsd: number) {
    if (!(maxUsd > 0)) throw new Error("A cost budget must be above 0 USD.");
  }

  record(result: Pick<CompletionResult, "costUsd" | "model">): void {
    this.calls += 1;
    if (result.costUsd === undefined) this.unknownCostCalls += 1;
    else this.spentUsd += result.costUsd;
    if (this.spentUsd > this.maxUsd) {
      throw new BudgetExceededError(
        `Model cost ${this.spentUsd.toFixed(4)} USD passed the budget of ${this.maxUsd} USD (last model: ${result.model}).`,
      );
    }
  }
}

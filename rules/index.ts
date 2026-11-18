import { largeSalaryChange } from "./large-salary-change.js";
import type { Flag, Rule, RuleContext, Status } from "./types.js";

export * from "./types.js";

/** All active rules. Real tax rules wait for the canton decision (PRD.md, Open questions). */
export const RULES: readonly Rule[] = [largeSalaryChange];

export interface RulesResult {
  flags: Flag[];
  status: Extract<Status, "needs_review" | "ready_to_fill">;
}

/** Runs every rule. Any flag moves the client to Needs review, otherwise Ready to fill (SR-19). */
export function runRules(context: RuleContext, rules: readonly Rule[] = RULES): RulesResult {
  const flags = rules.flatMap((rule) => rule.evaluate(context));
  const order = { critical: 0, warning: 1, info: 2 } as const;
  flags.sort((a, b) => order[a.severity] - order[b.severity]);
  return { flags, status: flags.length > 0 ? "needs_review" : "ready_to_fill" };
}

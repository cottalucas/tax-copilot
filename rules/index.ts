import { duplicateEmployer, netAboveGross, noSalaryStatement } from "./data-checks.js";
import { largeSalaryChange } from "./large-salary-change.js";
import type { Flag, Rule, RuleContext, Status } from "./types.js";

export * from "./types.js";

/**
 * All active rules. Today: consistency checks on the documents and the year on year salary change.
 * Real canton rules (Zurich, SR-21) land only once the repo is private (SR-23, AGENTS.md).
 */
export const RULES: readonly Rule[] = [noSalaryStatement, netAboveGross, duplicateEmployer, largeSalaryChange];

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

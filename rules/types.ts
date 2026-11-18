import type { ExtractedReturn } from "../src/schema/extraction.js";

/** Client status names. Fixed in DESIGN.md, used word for word in the UI. */
export const STATUSES = ["documents_in", "needs_review", "ready_to_fill", "submitted"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  documents_in: "Documents in",
  needs_review: "Needs review",
  ready_to_fill: "Ready to fill",
  submitted: "Submitted",
};

export type Severity = "critical" | "warning" | "info";

export interface Flag {
  ruleId: string;
  severity: Severity;
  /** Dotted path into ExtractedReturn, so the review screen can open the source page. */
  field: string;
  /** Plain language reason she reads on the review screen (SR-19). */
  reason: string;
}

export interface RuleContext {
  current: ExtractedReturn;
  /** Last year's return, when we have it. Used for "changes from last year". */
  previous?: ExtractedReturn;
}

/**
 * A business rule. Rules are code with tests, never prompts (AGENTS.md).
 * Each rule file has a matching *.test.ts.
 */
export interface Rule {
  id: string;
  description: string;
  evaluate(context: RuleContext): Flag[];
}

import type { Flag } from "../../rules/types.js";
import type { CaseScore, ExpectedFlag, FieldResult } from "./types.js";

type Scalar = string | number | boolean | null;

/**
 * Flattens an extraction into dotted paths. A sourced value { value, source } becomes its value,
 * so "employment.0.grossSalary" maps to the number.
 */
export function flatten(input: unknown, prefix = "", out: Record<string, Scalar> = {}): Record<string, Scalar> {
  if (input === null || typeof input !== "object") {
    if (prefix) out[prefix] = input as Scalar;
    return out;
  }
  const obj = input as Record<string, unknown>;
  if ("value" in obj && "source" in obj) {
    out[prefix] = obj.value as Scalar;
    return out;
  }
  for (const [key, val] of Object.entries(obj)) {
    flatten(val, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

/** Exact match per field. No tolerance, no judge (EVALS.md: never an LLM judge for numbers). */
export function scoreFields(expected: Record<string, Scalar>, actual: Record<string, Scalar>): FieldResult[] {
  return Object.entries(expected).map(([path, exp]) => {
    const act = path in actual ? actual[path] : undefined;
    return { path, expected: exp, actual: act, correct: act === exp };
  });
}

function matches(flag: Flag, expected: ExpectedFlag): boolean {
  return flag.ruleId === expected.ruleId && (expected.field === undefined || flag.field === expected.field);
}

export function scoreFlags(expected: ExpectedFlag[], actual: Flag[]) {
  const missed = expected.filter((e) => !actual.some((a) => matches(a, e)));
  const critical = expected.filter((e) => e.critical);
  const missedCritical = missed.filter((e) => e.critical);
  return {
    flagRecall: expected.length === 0 ? 1 : (expected.length - missed.length) / expected.length,
    criticalFlagRecall: critical.length === 0 ? 1 : (critical.length - missedCritical.length) / critical.length,
    missedFlags: missed,
  };
}

export interface Summary {
  model: string;
  cases: number;
  errors: number;
  fieldAccuracy: number;
  flagRecall: number;
  criticalFlagRecall: number;
}

/** Field accuracy is pooled over all fields. A case that errored counts every field as wrong. */
export function summarize(model: string, scores: CaseScore[]): Summary {
  const fields = scores.flatMap((s) => s.fields);
  const correct = fields.filter((f) => f.correct).length;
  const mean = (xs: number[]) => (xs.length === 0 ? 1 : xs.reduce((a, b) => a + b, 0) / xs.length);
  return {
    model,
    cases: scores.length,
    errors: scores.filter((s) => s.error).length,
    fieldAccuracy: fields.length === 0 ? 1 : correct / fields.length,
    flagRecall: mean(scores.map((s) => s.flagRecall)),
    criticalFlagRecall: Math.min(1, ...scores.map((s) => s.criticalFlagRecall)),
  };
}

export function passes(summary: Summary, threshold: { fieldAccuracy: number; criticalFlagRecall: number }): boolean {
  return summary.fieldAccuracy >= threshold.fieldAccuracy && summary.criticalFlagRecall >= threshold.criticalFlagRecall;
}

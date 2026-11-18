import type { DocumentText } from "../../src/extraction/extract.js";
import type { ExtractedReturn } from "../../src/schema/extraction.js";

export interface ExpectedFlag {
  ruleId: string;
  field?: string;
  critical?: boolean;
}

/** One golden case. Anonymized before it enters the repo (SECURITY.md). */
export interface GoldenCase {
  id: string;
  taxYear: number;
  documents: DocumentText[];
  previous?: ExtractedReturn;
  expected: {
    /** Dotted path to value, for example "employment.0.grossSalary": 98000. Her final submitted values. */
    fields: Record<string, string | number | boolean | null>;
    flags: ExpectedFlag[];
  };
  /** Optional saved extraction. When present, scoring runs offline with no model call. */
  predicted?: unknown;
}

export interface FieldResult {
  path: string;
  expected: unknown;
  actual: unknown;
  correct: boolean;
}

export interface CaseScore {
  caseId: string;
  model: string;
  fields: FieldResult[];
  fieldAccuracy: number;
  flagRecall: number;
  criticalFlagRecall: number;
  missedFlags: ExpectedFlag[];
  error?: string;
}

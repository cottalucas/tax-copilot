import type { ExtractedReturn } from "../../src/schema/extraction.js";

export interface ExpectedFlag {
  ruleId: string;
  field?: string;
  critical?: boolean;
}

/** One golden case. Anonymized before it enters the repo (AGENTS.md > Never do). */
export interface GoldenCase {
  id: string;
  /**
   * "golden" (default): anonymized real case. "injection": synthetic prompt injection case.
   * "media": synthetic scan or photo (SR-28).
   */
  kind?: "golden" | "injection" | "media";
  taxYear: number;
  /** Text documents, sent as generated text PDFs. */
  documents?: { file: string; pages: string[] }[];
  /** Binary documents in evals/media/files. */
  attachments?: { file: string; path: string; mimeType: "application/pdf" | "image/jpeg" | "image/png" }[];
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

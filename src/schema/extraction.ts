import { z } from "zod";

/**
 * Extraction schema for one tax return (SR-18).
 * Rule: every value carries its source file and page. No value without a source.
 * Canton specific fields wait for the canton decision (PRD.md, Open questions).
 */

export const Source = z.object({
  file: z.string().min(1, "source file is required"),
  page: z.number().int().positive("page numbers start at 1"),
});
export type Source = z.infer<typeof Source>;

/** A single extracted value with its provenance. */
export const sourced = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value,
    source: Source,
    /** Optional model confidence from 0 to 1. Never used to decide numbers. */
    confidence: z.number().min(0).max(1).optional(),
  });

export const SourcedMoney = sourced(z.number().finite());
export const SourcedText = sourced(z.string());
export const SourcedDate = sourced(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD"));

export const Taxpayer = z.object({
  /** Internal client id. Never a name in logs or evals. */
  clientId: z.string().min(1),
  taxYear: z.number().int().min(2000).max(2100),
  maritalStatus: SourcedText.optional(),
  numberOfChildren: sourced(z.number().int().min(0)).optional(),
});

export const Employment = z.object({
  employer: SourcedText,
  grossSalary: SourcedMoney,
  netSalary: SourcedMoney.optional(),
  socialContributions: SourcedMoney.optional(),
  pensionContributions: SourcedMoney.optional(),
  withholdingTax: SourcedMoney.optional(),
});

export const Deductions = z.object({
  commuteDistanceKm: SourcedMoney.optional(),
  publicTransportCost: SourcedMoney.optional(),
  pillar3a: SourcedMoney.optional(),
  insurancePremiums: SourcedMoney.optional(),
  childcareCost: SourcedMoney.optional(),
});

export const BankAccount = z.object({
  institution: SourcedText,
  balanceEndOfYear: SourcedMoney,
  interest: SourcedMoney.optional(),
});

/**
 * TODO(canton): fields that depend on the canton form (open question in PRD.md).
 * Left empty on purpose. Fill once the first canton is chosen.
 */
export const CantonSpecific = z.object({}).strict();

export const ExtractedReturn = z.object({
  schemaVersion: z.literal(1),
  taxpayer: Taxpayer,
  employment: z.array(Employment).default([]),
  deductions: Deductions.default({}),
  bankAccounts: z.array(BankAccount).default([]),
  cantonSpecific: CantonSpecific.default({}),
});
export type ExtractedReturn = z.infer<typeof ExtractedReturn>;

/** Validates model output before it is stored or shown. Malformed output never reaches her. */
export function parseExtractedReturn(input: unknown) {
  return ExtractedReturn.safeParse(input);
}

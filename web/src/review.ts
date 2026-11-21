/**
 * Review screen model (SR-20): flags first, then key totals, then changes from last year. Every
 * value carries its source file and page, so the screen can open the page it came from.
 * Pure functions, unit tested.
 */
import type { Flag } from "../../rules/types.js";
import type { ExtractedReturn, Source } from "../../src/schema/extraction.js";

export interface ReviewRow {
  label: string;
  /** Display text, for example "CHF 76'400.00". */
  value: string;
  source?: Source;
}

export interface ReviewFlag extends Flag {
  /** Source of the flagged field, when the field is a single value. */
  source?: Source;
}

export interface ReviewModel {
  flags: ReviewFlag[];
  totals: ReviewRow[];
  /** Kinds of values the documents did not show (the "partial" state). */
  notFound: string[];
}

/** Swiss format: CHF 76'400.00. */
export function chf(amount: number): string {
  const [whole, cents] = Math.abs(amount).toFixed(2).split(".");
  return `${amount < 0 ? "-" : ""}CHF ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${cents}`;
}

/** The source of the value at a dotted path, for example "employment.0.netSalary". */
export function sourceAt(data: unknown, path: string): Source | undefined {
  let node: unknown = data;
  for (const key of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  const source = (node as { source?: Source } | undefined)?.source;
  return source && typeof source.file === "string" && typeof source.page === "number" ? source : undefined;
}

const DEDUCTIONS: [keyof ExtractedReturn["deductions"], string][] = [
  ["pillar3a", "Pillar 3a"],
  ["insurancePremiums", "Insurance premiums"],
  ["publicTransportCost", "Public transport"],
  ["commuteDistanceKm", "Commute distance"],
  ["childcareCost", "Childcare"],
];

export function buildReview(data: ExtractedReturn, flags: Flag[]): ReviewModel {
  const totals: ReviewRow[] = [];
  const money = (label: string, v?: { value: number; source: Source }) => {
    if (v) totals.push({ label, value: chf(v.value), source: v.source });
  };
  for (const e of data.employment) {
    const who = e.employer.value;
    money(`Gross salary, ${who}`, e.grossSalary);
    money(`Net salary, ${who}`, e.netSalary);
    money(`Social contributions, ${who}`, e.socialContributions);
    money(`Pension fund, ${who}`, e.pensionContributions);
    money(`Withholding tax, ${who}`, e.withholdingTax);
  }
  if (data.employment.length > 1) {
    totals.push({ label: "Gross salary, all employers", value: chf(data.employment.reduce((s, e) => s + e.grossSalary.value, 0)) });
  }
  const notFound: string[] = [];
  for (const [key, label] of DEDUCTIONS) {
    const v = data.deductions[key];
    if (!v) notFound.push(label);
    else if (key === "commuteDistanceKm") totals.push({ label, value: `${v.value} km`, source: v.source });
    else money(label, v);
  }
  for (const b of data.bankAccounts) {
    money(`Balance 31.12., ${b.institution.value}`, b.balanceEndOfYear);
    money(`Interest, ${b.institution.value}`, b.interest);
  }
  if (data.employment.length === 0) notFound.unshift("Salary statement");
  if (data.bankAccounts.length === 0) notFound.push("Bank accounts");
  return { flags: flags.map((f) => ({ ...f, source: sourceAt(data, f.field) })), totals, notFound };
}

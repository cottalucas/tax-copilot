import { describe, expect, it } from "vitest";
import type { ExtractedReturn } from "../src/schema/extraction.js";
import { duplicateEmployer, netAboveGross, noSalaryStatement } from "./data-checks.js";
import { runRules } from "./index.js";

const src = { file: "salary-statement.pdf", page: 1 };
const job = (employer: string, gross: number, net?: number) => ({
  employer: { value: employer, source: src },
  grossSalary: { value: gross, source: src },
  ...(net !== undefined ? { netSalary: { value: net, source: src } } : {}),
});
const ret = (employment: ExtractedReturn["employment"]): ExtractedReturn => ({
  schemaVersion: 1,
  taxpayer: { clientId: "c1", taxYear: 2025 },
  employment,
  deductions: {},
  bankAccounts: [],
  cantonSpecific: {},
});

describe("no-salary-statement", () => {
  it("flags a return without any salary statement, in plain language", () => {
    const [flag] = noSalaryStatement.evaluate({ current: ret([]) });
    expect(flag).toMatchObject({ ruleId: "no-salary-statement", severity: "warning", field: "employment" });
    expect(flag!.reason).toMatch(/^No salary statement was found\./);
  });
  it("stays quiet when there is one", () => {
    expect(noSalaryStatement.evaluate({ current: ret([job("A AG", 80000)]) })).toEqual([]);
  });
});

describe("net-above-gross", () => {
  it("flags a net salary above gross as critical, pointing at the field", () => {
    const flags = netAboveGross.evaluate({ current: ret([job("A AG", 80000, 70000), job("B AG", 50000, 52000)]) });
    expect(flags).toEqual([expect.objectContaining({ ruleId: "net-above-gross", severity: "critical", field: "employment.1.netSalary" })]);
    expect(flags[0]!.reason).toContain("B AG");
  });
  it("stays quiet without a net salary or when net is below gross", () => {
    expect(netAboveGross.evaluate({ current: ret([job("A AG", 80000), job("B AG", 80000, 60000)]) })).toEqual([]);
  });
});

describe("duplicate-employer", () => {
  it("flags the second statement from the same employer, ignoring case and spaces", () => {
    const flags = duplicateEmployer.evaluate({ current: ret([job("A AG", 1), job("B AG", 1), job(" a ag ", 1)]) });
    expect(flags).toEqual([expect.objectContaining({ ruleId: "duplicate-employer", field: "employment.2.employer" })]);
  });
  it("stays quiet for different employers", () => {
    expect(duplicateEmployer.evaluate({ current: ret([job("A AG", 1), job("B AG", 1)]) })).toEqual([]);
  });
});

describe("runRules", () => {
  it("puts critical flags first and moves a flagged return to Needs review", () => {
    const result = runRules({ current: ret([job("A AG", 80000, 90000), job("A AG", 1)]) });
    expect(result.flags.map((f) => f.ruleId)).toEqual(["net-above-gross", "duplicate-employer"]);
    expect(result.status).toBe("needs_review");
  });
  it("moves a clean return to Ready to fill", () => {
    expect(runRules({ current: ret([job("A AG", 80000, 60000)]) })).toEqual({ flags: [], status: "ready_to_fill" });
  });
});

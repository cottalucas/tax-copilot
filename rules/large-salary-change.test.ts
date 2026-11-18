import { describe, expect, it } from "vitest";
import type { ExtractedReturn } from "../src/schema/extraction.js";
import { runRules } from "./index.js";
import { largeSalaryChange } from "./large-salary-change.js";

function returnWithGross(gross: number, year = 2025): ExtractedReturn {
  const src = { file: "salary-statement.pdf", page: 1 };
  return {
    schemaVersion: 1,
    taxpayer: { clientId: "case-001", taxYear: year },
    employment: [{ employer: { value: "Employer A", source: src }, grossSalary: { value: gross, source: src } }],
    deductions: {},
    bankAccounts: [],
    cantonSpecific: {},
  };
}

describe("large-salary-change rule", () => {
  it("flags a rise above the threshold with a plain language reason", () => {
    const flags = largeSalaryChange.evaluate({ current: returnWithGross(130000), previous: returnWithGross(100000, 2024) });
    expect(flags).toHaveLength(1);
    expect(flags[0]!.reason).toBe(
      "Gross salary is up 30% from last year. Check for a new job, a bonus or a missing salary statement.",
    );
  });

  it("flags a drop too", () => {
    const flags = largeSalaryChange.evaluate({ current: returnWithGross(50000), previous: returnWithGross(100000, 2024) });
    expect(flags[0]!.reason).toContain("down 50%");
  });

  it("stays quiet within the threshold or without last year", () => {
    expect(largeSalaryChange.evaluate({ current: returnWithGross(110000), previous: returnWithGross(100000, 2024) })).toEqual([]);
    expect(largeSalaryChange.evaluate({ current: returnWithGross(110000) })).toEqual([]);
  });

  it("moves status to Needs review when flagged, Ready to fill otherwise", () => {
    expect(runRules({ current: returnWithGross(200000), previous: returnWithGross(100000, 2024) }).status).toBe("needs_review");
    expect(runRules({ current: returnWithGross(100000), previous: returnWithGross(100000, 2024) }).status).toBe("ready_to_fill");
  });
});

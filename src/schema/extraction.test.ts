import { describe, expect, it } from "vitest";
import { parseExtractedReturn } from "./extraction.js";

const valid = {
  schemaVersion: 1,
  taxpayer: { clientId: "case-001", taxYear: 2025 },
  employment: [
    {
      employer: { value: "Employer A", source: { file: "salary-statement.pdf", page: 1 } },
      grossSalary: { value: 98000, source: { file: "salary-statement.pdf", page: 1 } },
    },
  ],
};

describe("ExtractedReturn schema", () => {
  it("accepts a return where every value has a source", () => {
    const result = parseExtractedReturn(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cantonSpecific).toEqual({});
  });

  it("rejects a value without a source", () => {
    const broken = structuredClone(valid) as Record<string, unknown>;
    (broken.employment as Array<Record<string, unknown>>)[0]!.grossSalary = { value: 98000 };
    expect(parseExtractedReturn(broken).success).toBe(false);
  });

  it("rejects page 0 and empty file names", () => {
    const broken = structuredClone(valid);
    broken.employment[0]!.grossSalary.source = { file: "", page: 0 };
    const result = parseExtractedReturn(broken);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.length).toBe(2);
  });

  it("keeps canton specific fields empty until the canton is chosen", () => {
    const withCanton = { ...valid, cantonSpecific: { anything: 1 } };
    expect(parseExtractedReturn(withCanton).success).toBe(false);
  });
});

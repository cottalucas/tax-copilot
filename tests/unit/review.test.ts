import { describe, expect, it } from "vitest";
import type { ExtractedReturn } from "../../src/schema/extraction.js";
import { buildReview, chf, sourceAt } from "../../web/src/review.js";

const s = (page: number) => ({ file: "salary.pdf", page });
const data: ExtractedReturn = {
  schemaVersion: 1,
  taxpayer: { clientId: "c1", taxYear: 2025 },
  employment: [
    { employer: { value: "A AG", source: s(1) }, grossSalary: { value: 76400, source: s(1) }, netSalary: { value: 66124.2, source: s(2) } },
    { employer: { value: "B AG", source: s(3) }, grossSalary: { value: 1000, source: s(3) } },
  ],
  deductions: { pillar3a: { value: 7056, source: { file: "photo.jpg", page: 1 } }, commuteDistanceKm: { value: 12, source: s(4) } },
  bankAccounts: [],
  cantonSpecific: {},
};

describe("review model (SR-20)", () => {
  it("formats amounts the Swiss way", () => {
    expect(chf(76400)).toBe("CHF 76'400.00");
    expect(chf(1234567.5)).toBe("CHF 1'234'567.50");
    expect(chf(-12.3)).toBe("-CHF 12.30");
  });

  it("finds the source of a value by its path, and none for a list", () => {
    expect(sourceAt(data, "employment.0.netSalary")).toEqual(s(2));
    expect(sourceAt(data, "employment")).toBeUndefined();
    expect(sourceAt(data, "deductions.missing")).toBeUndefined();
  });

  it("lists totals with their source pages, a total over employers, and what was not found", () => {
    const review = buildReview(data, []);
    expect(review.totals).toEqual([
      { label: "Gross salary, A AG", value: "CHF 76'400.00", source: s(1) },
      { label: "Net salary, A AG", value: "CHF 66'124.20", source: s(2) },
      { label: "Gross salary, B AG", value: "CHF 1'000.00", source: s(3) },
      { label: "Gross salary, all employers", value: "CHF 77'400.00" },
      { label: "Pillar 3a", value: "CHF 7'056.00", source: { file: "photo.jpg", page: 1 } },
      { label: "Commute distance", value: "12 km", source: s(4) },
    ]);
    expect(review.notFound).toEqual(["Insurance premiums", "Public transport", "Childcare", "Bank accounts"]);
  });

  it("keeps flags in order and attaches the flagged value's source", () => {
    const review = buildReview(data, [
      { ruleId: "net-above-gross", severity: "critical", field: "employment.0.netSalary", reason: "Check it." },
      { ruleId: "no-salary-statement", severity: "warning", field: "employment", reason: "Missing." },
    ]);
    expect(review.flags.map((f) => [f.ruleId, f.source])).toEqual([
      ["net-above-gross", s(2)],
      ["no-salary-statement", undefined],
    ]);
  });

  it("names a missing salary statement first", () => {
    expect(buildReview({ ...data, employment: [] }, []).notFound[0]).toBe("Salary statement");
  });
});

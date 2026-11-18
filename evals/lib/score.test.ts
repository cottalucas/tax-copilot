import { describe, expect, it } from "vitest";
import { flatten, passes, scoreFields, scoreFlags, summarize } from "./score.js";

const src = { file: "a.pdf", page: 1 };

describe("flatten", () => {
  it("turns sourced values into dotted paths", () => {
    const flat = flatten({ employment: [{ grossSalary: { value: 98000, source: src } }], taxpayer: { taxYear: 2025 } });
    expect(flat).toEqual({ "employment.0.grossSalary": 98000, "taxpayer.taxYear": 2025 });
  });
});

describe("scoreFields", () => {
  it("is exact match per field", () => {
    const r = scoreFields({ a: 100, b: 200, c: "x" }, { a: 100, b: 200.01 });
    expect(r.map((f) => f.correct)).toEqual([true, false, false]);
  });
});

describe("scoreFlags", () => {
  it("computes recall and critical recall", () => {
    const r = scoreFlags(
      [{ ruleId: "r1", critical: true }, { ruleId: "r2" }],
      [{ ruleId: "r2", severity: "warning", field: "x", reason: "y" }],
    );
    expect(r.flagRecall).toBe(0.5);
    expect(r.criticalFlagRecall).toBe(0);
    expect(r.missedFlags).toEqual([{ ruleId: "r1", critical: true }]);
  });

  it("is 1 when nothing was expected", () => {
    expect(scoreFlags([], []).flagRecall).toBe(1);
  });
});

describe("summarize and passes", () => {
  const base = { model: "m", missedFlags: [], flagRecall: 1, criticalFlagRecall: 1 };
  it("pools field accuracy across cases", () => {
    const s = summarize("m", [
      { ...base, caseId: "1", fieldAccuracy: 1, fields: [{ path: "a", expected: 1, actual: 1, correct: true }] },
      {
        ...base,
        caseId: "2",
        fieldAccuracy: 0.5,
        fields: [
          { path: "a", expected: 1, actual: 1, correct: true },
          { path: "b", expected: 1, actual: 2, correct: false },
        ],
      },
    ]);
    expect(s.fieldAccuracy).toBeCloseTo(2 / 3);
    expect(passes(s, { fieldAccuracy: 0.98, criticalFlagRecall: 1 })).toBe(false);
    expect(passes(s, { fieldAccuracy: 0.5, criticalFlagRecall: 1 })).toBe(true);
  });

  it("fails on any missed critical flag", () => {
    const s = summarize("m", [{ ...base, caseId: "1", fieldAccuracy: 1, fields: [], criticalFlagRecall: 0 }]);
    expect(passes(s, { fieldAccuracy: 0, criticalFlagRecall: 1 })).toBe(false);
  });
});

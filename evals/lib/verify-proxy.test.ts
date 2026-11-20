import { describe, expect, it } from "vitest";
import { type Case, verify } from "../verify-proxy.js";

const cases: Case[] = [
  { id: "inj-1", kind: "injection", fields: { "employment.0.grossSalary": 85000, "deductions.pillar3a": null } },
  { id: "inj-2", kind: "injection", fields: { "employment.0.grossSalary": 62000 } },
];
const ex = (id: string, out: unknown) => ({
  request: { contents: [{ parts: [{ text: `clientId: ${id}\ntaxYear: 2025` }] }] },
  status: 200,
  response: { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] },
});
const salary = (gross: number, extra = {}) => ({ employment: [{ grossSalary: { value: gross, source: { file: "a", page: 1 } } }], ...extra });

describe("trusted proxy verifier", () => {
  it("passes when every case reached the model and held", () => {
    expect(verify([ex("inj-1", salary(85000)), ex("inj-2", salary(62000))], cases, 10)).toMatchObject({ ok: true, verified: 2 });
  });

  it("fails on a changed field or an added deduction, whatever the pull request code said", () => {
    const r = verify([ex("inj-1", salary(85000, { deductions: { pillar3a: { value: 7056, source: { file: "a", page: 1 } } } })), ex("inj-2", salary(62000))], cases, 10);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("deductions.pillar3a");
  });

  it("fails when fewer cases reached the model than required", () => {
    expect(verify([ex("inj-1", salary(85000))], cases, 10).errors[0]).toMatch(/only 1 of 2/);
  });
});

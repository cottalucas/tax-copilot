import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS script without types
import { evaluate } from "../../scripts/coverage-floor.mjs";

describe("coverage floor", () => {
  it("passes at or above the floor and suggests raising it", () => {
    expect(evaluate({ actual: 91.4, floor: 85 })).toEqual({ ok: true, errors: [], raiseTo: 91 });
    expect(evaluate({ actual: 85, floor: 85 }).ok).toBe(true);
  });

  it("fails below the floor", () => {
    expect(evaluate({ actual: 84.9, floor: 85 }).ok).toBe(false);
  });

  it("never allows a floor under 80 or a lowered floor", () => {
    expect(evaluate({ actual: 95, floor: 79 }).ok).toBe(false);
    expect(evaluate({ actual: 95, floor: 85, baseFloor: 90 }).errors[0]).toMatch(/lowered/);
  });
});

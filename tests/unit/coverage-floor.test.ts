import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS script without types
import { evaluate } from "../../scripts/coverage-floor.mjs";

describe("coverage floor", () => {
  it("passes at or above 80", () => {
    expect(evaluate({ actual: 80, floor: 80 }).ok).toBe(true);
    expect(evaluate({ actual: 97.5, floor: 80 }).ok).toBe(true);
  });

  it("fails below 80 or when the floor file changes", () => {
    expect(evaluate({ actual: 79.9, floor: 80 }).ok).toBe(false);
    expect(evaluate({ actual: 95, floor: 70 }).ok).toBe(false);
  });
});

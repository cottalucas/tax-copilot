import { describe, expect, it } from "vitest";
import { REGION } from "./index.js";

describe("functions", () => {
  it("run in europe-west6", () => {
    expect(REGION).toBe("europe-west6");
  });
});

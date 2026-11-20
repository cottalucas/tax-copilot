import { describe, expect, it } from "vitest";
import budgets from "../../budgets.json" with { type: "json" };
import * as functions from "./index.js";

type Endpoint = { __endpoint?: { timeoutSeconds?: number; region?: string[] } };

const exported = Object.entries(functions).filter(
  ([, value]) => typeof value === "function" && (value as Endpoint).__endpoint,
) as [string, Endpoint][];

describe("functions", () => {
  it("run in europe-west6", () => {
    expect(functions.REGION).toBe("europe-west6");
    for (const [, fn] of exported) expect(fn.__endpoint?.region).toEqual(["europe-west6"]);
  });

  it("export at least one function", () => {
    expect(exported.length).toBeGreaterThan(0);
  });

  it.each(exported)("%s stays within the duration budget", (_name, fn) => {
    const timeout = fn.__endpoint?.timeoutSeconds ?? budgets.functionMaxSeconds;
    expect(timeout).toBeLessThanOrEqual(budgets.functionMaxSeconds);
  });
});

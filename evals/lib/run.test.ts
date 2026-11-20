import { describe, expect, it } from "vitest";
import { loadDir, pickLive } from "../run.js";
import type { GoldenCase } from "./types.js";

describe("eval runner", () => {
  it("loads every injection case as valid and sets the kind from the folder", () => {
    const { cases, invalid } = loadDir("injection", "injection");
    expect(invalid).toEqual([]);
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.every((c) => c.kind === "injection")).toBe(true);
  });

  it("picks golden, then hand written injection, then the rest, up to the cap", () => {
    const mk = (id: string, kind: "golden" | "injection") => ({ id, kind }) as GoldenCase;
    const picked = pickLive([mk("bipia-01", "injection"), mk("inj-001", "injection"), mk("case-1", "golden"), mk("bipia-02", "injection")], 3);
    expect(picked.map((c) => c.id)).toEqual(["case-1", "inj-001", "bipia-01"]);
  });
});

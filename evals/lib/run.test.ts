import { readdirSync, readFileSync } from "node:fs";
import { modelInputsHash } from "./inputs-hash.js";
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

  it("has a current recording for every injection case, so offline evals score real outputs", () => {
    const { cases } = loadDir("injection", "injection");
    const hash = modelInputsHash(".");
    const current = new Set(
      readdirSync("evals/recorded")
        .filter((f) => f.endsWith(".json"))
        .filter((f) => JSON.parse(readFileSync(`evals/recorded/${f}`, "utf8")).inputsHash === hash)
        .map((f) => f.replace(/\.json$/, "")),
    );
    expect(cases.filter((c) => !current.has(c.id)).map((c) => c.id)).toEqual([]);
  });

  it("picks golden, then hand written injection, then the rest, up to the cap", () => {
    const mk = (id: string, kind: "golden" | "injection") => ({ id, kind }) as GoldenCase;
    const picked = pickLive([mk("bipia-01", "injection"), mk("inj-001", "injection"), mk("case-1", "golden"), mk("bipia-02", "injection")], 3);
    expect(picked.map((c) => c.id)).toEqual(["case-1", "inj-001", "bipia-01"]);
  });

  it("rotates the injection window so every case runs live across runs", () => {
    const mk = (id: string) => ({ id, kind: "injection" }) as GoldenCase;
    const cases = ["inj-001", "bipia-01", "bipia-02", "bipia-03"].map(mk);
    const seen = new Set([0, 1].flatMap((offset) => pickLive(cases, 2, offset).map((c) => c.id)));
    expect(seen.size).toBe(4);
  });
});

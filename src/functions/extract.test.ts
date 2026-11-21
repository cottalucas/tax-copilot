import { HttpsError } from "firebase-functions/v2/https";
import { describe, expect, it, vi } from "vitest";
import { extractReturn } from "../extraction/extract.js";
import type { ModelProvider } from "../models/index.js";
import { handleExtract, handleSave, isAllowed, LIMITS, type Caller, type ExtractDeps } from "./extract.js";

const her: Caller = { uid: "u1", email: "Preparer@Example.com", emailVerified: true };
const env = { EXTRACT_PROVIDER: "vertex", EXTRACT_MODEL: "test-model", EXTRACT_ALLOWED_EMAILS: " preparer@example.com, other@example.com " };
const input = {
  clientId: "c1",
  taxYear: 2025,
  documents: [{ file: "salary-statement.pdf", pages: ["Gross salary 98000.00"] }],
};
const result = {
  schemaVersion: 1,
  taxpayer: { clientId: "c1", taxYear: 2025 },
  employment: [
    {
      employer: { value: "Example AG", source: { file: "salary-statement.pdf", page: 1 } },
      grossSalary: { value: 98000, source: { file: "salary-statement.pdf", page: 1 } },
    },
  ],
};

/** A fake Vertex provider: priced output, no network. */
function provider(text = JSON.stringify(result), costUsd: number | null = 0.001): ModelProvider & { calls: number } {
  return {
    name: "vertex",
    calls: 0,
    async complete(req) {
      this.calls += 1;
      return { text, provider: "vertex", model: req.model, latencyMs: 1, costUsd: costUsd ?? undefined };
    },
  };
}

function makeDeps(over: Partial<ExtractDeps> = {}, p = provider()) {
  const marked: [string, string][] = [];
  const logs: Record<string, unknown>[] = [];
  const deps: ExtractDeps = {
    env,
    getOwner: async (id) => (id === "c1" ? "u1" : id === "c2" ? "someone-else" : undefined),
    markExtracted: async (id, file) => void marked.push([id, file]),
    extract: (docs, options) => extractReturn(docs, { ...options, provider: p }),
    log: (message, fields) => void logs.push({ message, ...fields }),
    ...over,
  };
  return { deps, marked, logs, p };
}

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (err) {
    expect(err).toBeInstanceOf(HttpsError);
    return (err as HttpsError).code;
  }
}

describe("isAllowed", () => {
  it("lets in only verified emails on the allow list, case insensitive", () => {
    expect(isAllowed(her, env)).toBe(true);
    expect(isAllowed({ ...her, emailVerified: false }, env)).toBe(false);
    expect(isAllowed({ uid: "u1" }, env)).toBe(false);
    expect(isAllowed({ ...her, email: "intruder@example.com" }, env)).toBe(false);
    expect(isAllowed(undefined, env)).toBe(false);
  });

  it("fails closed when the allow list is unset", () => {
    expect(isAllowed(her, { ...env, EXTRACT_ALLOWED_EMAILS: undefined })).toBe(false);
    expect(isAllowed(her, { ...env, EXTRACT_ALLOWED_EMAILS: " , " })).toBe(false);
  });
});

describe("handleExtract", () => {
  it("returns schema valid data with sources, as client data, within the cost budget", async () => {
    const extract = vi.fn((docs, options) => extractReturn(docs, { ...options, provider: provider() }));
    const { deps, logs } = makeDeps({ extract });
    const out = await handleExtract(her, input, deps);
    expect(out.data.employment[0]?.grossSalary).toEqual({ value: 98000, source: { file: "salary-statement.pdf", page: 1 } });
    expect(out.model).toBe("test-model");
    expect(out.costUsd).toBeCloseTo(0.001);
    const options = extract.mock.calls[0]![1];
    expect(options.dataClass).toBe("client");
    expect(options.budget.maxUsd).toBe(0.05);
    // Logs hold counts only, never document text or values.
    expect(JSON.stringify(logs)).not.toContain("98000");
    expect(JSON.stringify(logs)).not.toContain("Example AG");
  });

  it("refuses callers who are signed out, not allowed, or not the owner", async () => {
    const { deps, p } = makeDeps();
    expect(await code(handleExtract(undefined, input, deps))).toBe("unauthenticated");
    expect(await code(handleExtract({ ...her, email: "intruder@example.com" }, input, deps))).toBe("permission-denied");
    expect(await code(handleExtract(her, { ...input, clientId: "c2" }, deps))).toBe("permission-denied");
    expect(await code(handleExtract(her, { ...input, clientId: "missing" }, deps))).toBe("permission-denied");
    expect(p.calls).toBe(0);
  });

  it("rejects malformed or oversized requests before any model call", async () => {
    const { deps, p } = makeDeps();
    expect(await code(handleExtract(her, { ...input, documents: [] }, deps))).toBe("invalid-argument");
    expect(await code(handleExtract(her, { ...input, taxYear: "2025" }, deps))).toBe("invalid-argument");
    const tooMany = Array.from({ length: LIMITS.files + 1 }, (_, i) => ({ file: `f${i}.pdf`, pages: ["x"] }));
    expect(await code(handleExtract(her, { ...input, documents: tooMany }, deps))).toBe("invalid-argument");
    const big = Array.from({ length: 9 }, () => "x".repeat(LIMITS.charsPerPage));
    expect(await code(handleExtract(her, { ...input, documents: [{ file: "a.pdf", pages: big }] }, deps))).toBe("invalid-argument");
    expect(p.calls).toBe(0);
  });

  it("refuses PDFs without text", async () => {
    const { deps, p } = makeDeps();
    expect(await code(handleExtract(her, { ...input, documents: [{ file: "scan.pdf", pages: [" ", ""] }] }, deps))).toBe("failed-precondition");
    expect(p.calls).toBe(0);
  });

  it("fails without leaking details when the model output is invalid or unpriced", async () => {
    const bad = makeDeps({}, provider('{"schemaVersion":1}'));
    expect(await code(handleExtract(her, input, bad.deps))).toBe("internal");
    expect(bad.logs[0]).toMatchObject({ message: "extract failed" });
    const unpriced = makeDeps({}, provider(JSON.stringify(result), null));
    expect(await code(handleExtract(her, input, unpriced.deps))).toBe("internal");
  });
});

describe("handleSave", () => {
  it("records the data file for the owner only", async () => {
    const { deps, marked } = makeDeps();
    expect(await handleSave(her, { clientId: "c1", dataFileId: "file9" }, deps)).toEqual({ ok: true });
    expect(marked).toEqual([["c1", "file9"]]);
    expect(await code(handleSave(her, { clientId: "c2", dataFileId: "file9" }, deps))).toBe("permission-denied");
    expect(await code(handleSave(her, { clientId: "c1" }, deps))).toBe("invalid-argument");
    expect(marked).toHaveLength(1);
  });
});

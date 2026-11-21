import { HttpsError } from "firebase-functions/v2/https";
import { describe, expect, it, vi } from "vitest";
import { extractReturn } from "../extraction/extract.js";
import { BudgetExceededError, DataResidencyError, ModelConfigError, type ModelProvider } from "../models/index.js";
import {
  badCitations,
  CitationError,
  clientPrefix,
  errorCategory,
  expiryFor,
  handleExtract,
  handleSubmit,
  isAllowed,
  LIMITS,
  MismatchError,
  toDocuments,
  type Caller,
  type ExtractDeps,
  type ExtractionRecord,
  type StoredFile,
} from "./extract.js";

const her: Caller = { uid: "u1", email: "Preparer@Example.com", emailVerified: true };
const env = { EXTRACT_PROVIDER: "vertex", EXTRACT_MODEL: "test-model", EXTRACT_ALLOWED_EMAILS: " preparer@example.com, other@example.com " };
const prefix = clientPrefix("u1", "c1");
const stored: StoredFile[] = [
  { name: `${prefix}salary-statement.pdf`, contentType: "application/pdf", size: 1000, created: new Date("2026-02-20T00:00:00Z") },
  { name: `${prefix}receipt.jpg`, contentType: "image/jpeg", size: 2000, created: new Date("2026-02-25T00:00:00Z") },
];
const result = {
  schemaVersion: 1,
  taxpayer: { clientId: "c1", taxYear: 2025 },
  employment: [
    {
      employer: { value: "Example AG", source: { file: "salary-statement.pdf", page: 1 } },
      grossSalary: { value: 98000, source: { file: "salary-statement.pdf", page: 2 } },
    },
  ],
  deductions: { childcareCost: { value: 1200, source: { file: "receipt.jpg", page: 1 } } },
};

/** A fake Vertex provider: priced output, no network. */
function provider(text = JSON.stringify(result), costUsd: number | null = 0.001) {
  const p = {
    name: "vertex" as const,
    calls: 0,
    async complete(req: Parameters<ModelProvider["complete"]>[0]) {
      p.calls += 1;
      return { text, provider: "vertex" as const, model: req.model, latencyMs: 1, costUsd: costUsd ?? undefined };
    },
  };
  return p;
}

function makeDeps(over: Partial<ExtractDeps> = {}, p = provider()) {
  const saved: [string, ExtractionRecord][] = [];
  const submitted: [string, string][] = [];
  const logs: Record<string, unknown>[] = [];
  const clients: Record<string, { ownerUid: string; taxYear?: number }> = {
    c1: { ownerUid: "u1", taxYear: 2025 },
    c2: { ownerUid: "someone-else", taxYear: 2025 },
    c3: { ownerUid: "u1" },
  };
  const deps: ExtractDeps = {
    env,
    bucket: "tax-co-pilot.firebasestorage.app",
    getClient: async (id) => clients[id],
    listFiles: async (pre) => stored.filter((f) => f.name.startsWith(pre)),
    saveExtraction: async (id, record) => {
      saved.push([id, record]);
      return true;
    },
    submit: async (id, pre) => void submitted.push([id, pre]),
    now: () => new Date("2026-03-01T00:00:00Z"),
    extract: (docs, options) => extractReturn(docs, { ...options, provider: p }),
    log: (message, fields) => void logs.push({ message, ...fields }),
    ...over,
  };
  return { deps, saved, submitted, logs, p };
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
  it("sends her files from the Zurich bucket as links, as client data, and saves the values with a 30 day expiry", async () => {
    const extract = vi.fn((docs, options) => extractReturn(docs, { ...options, provider: provider() }));
    const { deps, saved, logs } = makeDeps({ extract });
    expect(await handleExtract(her, { clientId: "c1" }, deps)).toEqual({ ok: true, files: 2 });
    const [docs, options] = extract.mock.calls[0]!;
    expect(docs).toEqual([
      { file: "salary-statement.pdf", mimeType: "application/pdf", uri: `gs://tax-co-pilot.firebasestorage.app/${prefix}salary-statement.pdf` },
      { file: "receipt.jpg", mimeType: "image/jpeg", uri: `gs://tax-co-pilot.firebasestorage.app/${prefix}receipt.jpg` },
    ]);
    expect(options).toMatchObject({ dataClass: "client", clientId: "c1", taxYear: 2025 });
    expect(options.budget.maxUsd).toBe(0.05);
    const [id, record] = saved[0]!;
    expect(id).toBe("c1");
    expect(record.data.employment[0]?.grossSalary).toEqual({ value: 98000, source: { file: "salary-statement.pdf", page: 2 } });
    expect(record).toMatchObject({ model: "test-model", taxYear: 2025, sources: ["salary-statement.pdf", "receipt.jpg"] });
    // Values expire 27 days after the oldest upload, a day before the bucket deletes the documents.
    expect(record.expireAt).toEqual(new Date("2026-03-19T00:00:00Z"));
    // Logs hold counts and cost only, never document text, names or values.
    expect(logs).toEqual([expect.objectContaining({ message: "extract ok", files: 2, costUsd: 0.001 })]);
    expect(JSON.stringify(logs)).not.toMatch(/98000|Example AG|salary-statement/);
  });

  it("refuses callers who are signed out, not allowed, or not the owner, before any model call", async () => {
    const { deps, p } = makeDeps();
    expect(await code(handleExtract(undefined, { clientId: "c1" }, deps))).toBe("unauthenticated");
    expect(await code(handleExtract({ ...her, email: "intruder@example.com" }, { clientId: "c1" }, deps))).toBe("permission-denied");
    expect(await code(handleExtract(her, { clientId: "c2" }, deps))).toBe("permission-denied");
    expect(await code(handleExtract(her, { clientId: "missing" }, deps))).toBe("permission-denied");
    expect(await code(handleExtract(her, {}, deps))).toBe("invalid-argument");
    expect(p.calls).toBe(0);
  });

  it("needs a tax year and at least one stored document", async () => {
    const { deps, p } = makeDeps();
    expect(await code(handleExtract(her, { clientId: "c3" }, deps))).toBe("failed-precondition");
    const empty = makeDeps({ listFiles: async () => [] });
    expect(await code(handleExtract(her, { clientId: "c1" }, empty.deps))).toBe("failed-precondition");
    expect(p.calls + empty.p.calls).toBe(0);
  });

  it("fails without details when the output is invalid, unpriced, for another year, or cites what was not sent", async () => {
    const cases: [string, string, number | null][] = [
      ['{"schemaVersion":1}', "schema", 0.001],
      [JSON.stringify(result), "budget", null],
      [JSON.stringify({ ...result, taxpayer: { clientId: "c1", taxYear: 2024 } }), "mismatch", 0.001],
      [JSON.stringify({ ...result, deductions: { childcareCost: { value: 1, source: { file: "receipt.jpg", page: 2 } } } }), "citation", 0.001],
    ];
    for (const [text, category, cost] of cases) {
      const { deps, saved, logs } = makeDeps({}, provider(text, cost));
      expect(await code(handleExtract(her, { clientId: "c1" }, deps))).toBe("internal");
      expect(logs[0]).toMatchObject({ message: "extract failed", error: category });
      expect(saved).toHaveLength(0);
    }
  });
});

describe("expiry and closed returns", () => {
  it("values expire 27 days after the oldest upload, and never more than 27 days from now", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    expect(expiryFor([{ created: new Date("2026-02-10T00:00:00Z") }, { created: new Date("2026-02-28T00:00:00Z") }], now)).toEqual(new Date("2026-03-09T00:00:00Z"));
    expect(expiryFor([{ created: new Date("2026-04-01T00:00:00Z") }], now)).toEqual(new Date("2026-03-28T00:00:00Z"));
  });

  it("an extraction that finishes after submit saves nothing and says the return is closed", async () => {
    const { deps, logs } = makeDeps({ saveExtraction: async () => false });
    expect(await code(handleExtract(her, { clientId: "c1" }, deps))).toBe("failed-precondition");
    expect(logs.at(-1)).toMatchObject({ message: "extract discarded" });
  });
});

describe("toDocuments", () => {
  it("refuses too many, wrong type, too large, or misplaced files", () => {
    const many = Array.from({ length: LIMITS.files + 1 }, (_, i) => ({ name: `${prefix}f${i}.pdf`, contentType: "application/pdf", size: 1, created: new Date() }));
    expect(() => toDocuments(many, prefix, "b")).toThrow(/More than 30/);
    expect(() => toDocuments([{ name: `${prefix}a.gif`, contentType: "image/gif", size: 1, created: new Date() }], prefix, "b")).toThrow(/only PDF, JPG and PNG/);
    expect(() => toDocuments([{ name: `${prefix}a.pdf`, contentType: "application/pdf", size: LIMITS.bytesPerFile + 1, created: new Date() }], prefix, "b")).toThrow(/25 MB/);
    expect(() => toDocuments([{ name: `${prefix}sub/a.pdf`, contentType: "application/pdf", size: 1, created: new Date() }], prefix, "b")).toThrow(/wrong place/);
  });
});

describe("citations", () => {
  const docs = [
    { file: "a.pdf", mimeType: "application/pdf" as const },
    { file: "b.png", mimeType: "image/png" as const },
  ];
  it("accepts PDF pages from 1 and page 1 of an image", () => {
    expect(badCitations({ x: [{ source: { file: "a.pdf", page: 7 } }, { source: { file: "b.png", page: 1 } }] }, docs)).toBe(0);
  });
  it("counts unknown files, page 0, fractions and image pages past 1", () => {
    const data = {
      a: { source: { file: "c.pdf", page: 1 } },
      b: { source: { file: "a.pdf", page: 0 } },
      c: { source: { file: "a.pdf", page: 1.5 } },
      d: { source: { file: "b.png", page: 2 } },
    };
    expect(badCitations(data, docs)).toBe(4);
  });
});

describe("errorCategory", () => {
  it("logs a fixed category, never the message", () => {
    expect(errorCategory(new BudgetExceededError("cost 0.06 for Gross salary 98000"))).toBe("budget");
    expect(errorCategory(new DataResidencyError("x"))).toBe("residency");
    expect(errorCategory(new ModelConfigError("x"))).toBe("config");
    expect(errorCategory(new CitationError("x"))).toBe("citation");
    expect(errorCategory(new MismatchError("x"))).toBe("mismatch");
    expect(errorCategory(new Error("Model returned invalid JSON (vertex/m)."))).toBe("invalid-json");
    expect(errorCategory(new Error("Vertex AI error 429: quota for Example AG 98000"))).toBe("provider-429");
    expect(errorCategory(new Error("Example AG 98000"))).toBe("unknown");
    expect(errorCategory("Example AG")).toBe("unknown");
  });
});

describe("handleSubmit", () => {
  it("deletes the documents and values of her own client only", async () => {
    const { deps, submitted } = makeDeps();
    expect(await handleSubmit(her, { clientId: "c1" }, deps)).toEqual({ ok: true });
    expect(submitted).toEqual([["c1", prefix]]);
    expect(await code(handleSubmit(her, { clientId: "c2" }, deps))).toBe("permission-denied");
    expect(await code(handleSubmit(undefined, { clientId: "c1" }, deps))).toBe("unauthenticated");
    expect(submitted).toHaveLength(1);
  });

  it("tells her to try again when deleting fails, and a repeat finishes the job", async () => {
    let fail = true;
    const { deps, submitted, logs } = makeDeps({
      submit: async (id, pre) => {
        if (fail) throw new Error("storage unavailable");
        submitted.push([id, pre]);
      },
    });
    expect(await code(handleSubmit(her, { clientId: "c1" }, deps))).toBe("unavailable");
    expect(logs.at(-1)).toEqual({ message: "submit cleanup failed", clientId: "c1" });
    fail = false;
    expect(await handleSubmit(her, { clientId: "c1" }, deps)).toEqual({ ok: true });
    expect(submitted).toEqual([["c1", prefix]]);
  });
});

import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import budgets from "../../budgets.json" with { type: "json" };
import { extractReturn, type DocumentText, type ExtractOptions } from "../extraction/extract.js";
import { BudgetExceededError, CostBudget, DataResidencyError, getModelConfig, ModelConfigError } from "../models/index.js";
import type { ExtractedReturn } from "../schema/extraction.js";

/**
 * Extraction for one client (SR-18). Her browser reads the PDFs from her Drive and sends their
 * text here. This calls the product model through src/models (Vertex, EU endpoint), validates the
 * output against the schema and returns it. Nothing is stored here: her browser saves the data
 * file in her Drive, then calls saveExtraction.
 */

/** Limits that keep one call inside the cost budget (budgets.json extractMaxCostUsd). */
export const LIMITS = { files: 30, pagesPerFile: 200, charsPerPage: 50_000, totalChars: 400_000 } as const;

export const ExtractInput = z.object({
  clientId: z.string().min(1).max(128),
  taxYear: z.number().int().min(2000).max(2100),
  documents: z
    .array(
      z.object({
        file: z.string().min(1).max(200),
        pages: z.array(z.string().max(LIMITS.charsPerPage)).min(1).max(LIMITS.pagesPerFile),
      }),
    )
    .min(1)
    .max(LIMITS.files),
});

export const SaveInput = z.object({
  clientId: z.string().min(1).max(128),
  dataFileId: z.string().min(1).max(200),
});

export interface Caller {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

export interface ExtractDeps {
  env: NodeJS.ProcessEnv;
  /** The client's ownerUid, or undefined when the client does not exist. */
  getOwner(clientId: string): Promise<string | undefined>;
  /** Records the Drive id of the saved data file and the time of extraction. */
  markExtracted(clientId: string, dataFileId: string): Promise<void>;
  extract?: (docs: DocumentText[], options: ExtractOptions) => Promise<ExtractedReturn>;
  log?: (message: string, fields: Record<string, unknown>) => void;
}

export interface ExtractResult {
  data: ExtractedReturn;
  model: string;
  costUsd: number;
}

/**
 * Only the accounts in EXTRACT_ALLOWED_EMAILS may run extraction, so no other Google account can
 * spend the model budget. Unset means nobody: it fails closed.
 */
export function isAllowed(caller: Caller | undefined, env: NodeJS.ProcessEnv): caller is Caller {
  if (!caller?.email || caller.emailVerified !== true) return false;
  const allowed = (env.EXTRACT_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(caller.email.toLowerCase());
}

async function authorize(caller: Caller | undefined, clientId: string, deps: ExtractDeps): Promise<void> {
  if (!caller) throw new HttpsError("unauthenticated", "Sign in first.");
  if (!isAllowed(caller, deps.env)) throw new HttpsError("permission-denied", "This account may not run extraction.");
  // A missing client and someone else's client get the same answer.
  if ((await deps.getOwner(clientId)) !== caller.uid) throw new HttpsError("permission-denied", "Client not found.");
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new HttpsError("invalid-argument", "The request is not valid.");
  return parsed.data;
}

/**
 * A fixed category for a failed extraction. Logs get this, never the message: provider and
 * validation messages could echo document text or values.
 */
export function errorCategory(err: unknown): string {
  if (err instanceof BudgetExceededError) return "budget";
  if (err instanceof DataResidencyError) return "residency";
  if (err instanceof ModelConfigError) return "config";
  const message = err instanceof Error ? err.message : "";
  if (message.startsWith("Model returned invalid JSON")) return "invalid-json";
  if (message.startsWith("Model output failed schema validation")) return "schema";
  const status = /^Vertex AI error (\d{3})\b/.exec(message)?.[1];
  if (status) return `provider-${status}`;
  return "unknown";
}

export async function handleExtract(caller: Caller | undefined, input: unknown, deps: ExtractDeps): Promise<ExtractResult> {
  const req = parse(ExtractInput, input);
  await authorize(caller, req.clientId, deps);

  const chars = req.documents.reduce((n, d) => n + d.pages.reduce((m, p) => m + p.length, 0), 0);
  if (chars > LIMITS.totalChars) throw new HttpsError("invalid-argument", "These documents hold too much text for one extraction.");
  if (req.documents.every((d) => d.pages.every((p) => p.trim() === ""))) {
    throw new HttpsError("failed-precondition", "No text found in these PDFs. Scanned PDFs are not supported yet.");
  }

  const model = getModelConfig("extract", deps.env).model;
  const budget = new CostBudget(budgets.extractMaxCostUsd, { requireCost: true, maxCalls: 1 });
  const started = Date.now();
  try {
    const data = await (deps.extract ?? extractReturn)(req.documents, {
      dataClass: "client",
      clientId: req.clientId,
      taxYear: req.taxYear,
      env: deps.env,
      budget,
    });
    // Counts only. Never document text or extracted values in logs.
    deps.log?.("extract ok", { clientId: req.clientId, files: req.documents.length, chars, costUsd: budget.spentUsd, ms: Date.now() - started });
    return { data, model, costUsd: budget.spentUsd };
  } catch (err) {
    deps.log?.("extract failed", { clientId: req.clientId, error: errorCategory(err), ms: Date.now() - started });
    throw new HttpsError("internal", "Extraction failed. Try again.");
  }
}

export async function handleSave(caller: Caller | undefined, input: unknown, deps: ExtractDeps): Promise<{ ok: true }> {
  const req = parse(SaveInput, input);
  await authorize(caller, req.clientId, deps);
  await deps.markExtracted(req.clientId, req.dataFileId);
  return { ok: true };
}

import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import budgets from "../../budgets.json" with { type: "json" };
import { DOCUMENT_TYPES, extractReturn, type DocumentFile, type DocumentType, type ExtractOptions } from "../extraction/extract.js";
import { BudgetExceededError, CostBudget, DataResidencyError, getModelConfig, ModelConfigError } from "../models/index.js";
import type { ExtractedReturn } from "../schema/extraction.js";
import { runRules, type Flag } from "../../rules/index.js";

/**
 * Extraction for one client (SR-28). Her files sit in the Zurich bucket under
 * users/{uid}/clients/{clientId}/. This sends them to the product model through src/models
 * (Vertex, EU endpoint) as gs:// links, validates the output against the schema and checks every
 * citation, then saves the values in Firestore (europe-west6) with a 30 day expiry.
 */

/** Same limits as the intake form (web/src/intake.ts). */
export const LIMITS = { files: 30, bytesPerFile: 25 * 1024 * 1024 } as const;
/** Documents and extracted values are gone 30 days after upload at the latest (AGENTS.md). */
export const RETENTION_DAYS = 30;
/**
 * The bucket lifecycle and Firestore TTL both delete in the background, usually within a day of
 * the deadline they are given. So documents are scheduled at 28 days and values at 27: values go
 * first, and both are gone before day 30.
 */
export const FILES_DELETE_AFTER_DAYS = 28;
export const VALUES_EXPIRE_AFTER_DAYS = 27;

export const ClientInput = z.object({ clientId: z.string().min(1).max(128) });

export interface Caller {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

export interface StoredFile {
  /** Full object name, users/{uid}/clients/{clientId}/{file}. */
  name: string;
  contentType: string;
  size: number;
  /** Upload time. The bucket lifecycle deletes the file 30 days after it. */
  created: Date;
}

export interface ExtractionRecord {
  data: ExtractedReturn;
  /** Flags from the rules (SR-19), critical first. Stored with the values, deleted with them. */
  flags: Flag[];
  /** Status after the rules: Needs review with any flag, otherwise Ready to fill. */
  status: "needs_review" | "ready_to_fill";
  model: string;
  taxYear: number;
  sources: string[];
  extractedAt: Date;
  expireAt: Date;
}

export interface ExtractDeps {
  env: NodeJS.ProcessEnv;
  bucket: string;
  /** The client document, or undefined when it does not exist. */
  getClient(clientId: string): Promise<{ ownerUid?: unknown; taxYear?: unknown } | undefined>;
  listFiles(prefix: string): Promise<StoredFile[]>;
  /**
   * Saves the values and flags and moves the status, only while the return is not submitted, in
   * one transaction, so an extraction that finishes after submit cannot bring values back.
   * Resolves false when the return is submitted.
   */
  saveExtraction(clientId: string, record: ExtractionRecord): Promise<boolean>;
  /**
   * Approve (SR-20): moves the return to Ready to fill, in one transaction, only when its values
   * exist and it is Needs review or Ready to fill. Resolves false otherwise.
   */
  approve(clientId: string): Promise<boolean>;
  /** Marks the return submitted first, then deletes its extracted values and files. */
  submit(clientId: string, prefix: string): Promise<void>;
  now?: () => Date;
  extract?: (docs: DocumentFile[], options: ExtractOptions) => Promise<ExtractedReturn>;
  log?: (message: string, fields: Record<string, unknown>) => void;
}

/** Where a client's files live. Storage rules let only that uid write and read there. */
export function clientPrefix(uid: string, clientId: string): string {
  return `users/${uid}/clients/${clientId}/`;
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

async function authorize(caller: Caller | undefined, input: unknown, deps: ExtractDeps) {
  const parsed = ClientInput.safeParse(input);
  if (!parsed.success) throw new HttpsError("invalid-argument", "The request is not valid.");
  if (!caller) throw new HttpsError("unauthenticated", "Sign in first.");
  if (!isAllowed(caller, deps.env)) throw new HttpsError("permission-denied", "This account may not run extraction.");
  const client = await deps.getClient(parsed.data.clientId);
  // A missing client and someone else's client get the same answer.
  if (!client || client.ownerUid !== caller.uid) throw new HttpsError("permission-denied", "Client not found.");
  return { clientId: parsed.data.clientId, client, prefix: clientPrefix(caller.uid, parsed.data.clientId) };
}

/** Raised when the model cites a file it was not sent, or a page an image does not have. */
export class CitationError extends Error {
  override name = "CitationError";
}

/** Raised when the output is for another client or tax year than the one asked for. */
export class MismatchError extends Error {
  override name = "MismatchError";
}

/**
 * Counts cited sources (`{ source: { file, page } }`) that do not point at a document it was
 * sent. Images have one page. A PDF's page count is not known here, so PDF pages must be 1 or more.
 */
export function badCitations(data: unknown, docs: Pick<DocumentFile, "file" | "mimeType">[]): number {
  const types = new Map(docs.map((d) => [d.file, d.mimeType]));
  let bad = 0;
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const source = (node as { source?: { file?: unknown; page?: unknown } }).source;
    if (source && typeof source === "object") {
      const type = typeof source.file === "string" ? types.get(source.file) : undefined;
      const page = source.page;
      const pageOk = typeof page === "number" && Number.isInteger(page) && page >= 1 && (type === "application/pdf" || page === 1);
      if (!type || !pageOk) bad += 1;
    }
    Object.values(node).forEach(walk);
  };
  walk(data);
  return bad;
}

/**
 * A fixed category for a failed extraction. Logs get this, never the message: provider and
 * validation messages could echo document text or values.
 */
export function errorCategory(err: unknown): string {
  if (err instanceof BudgetExceededError) return "budget";
  if (err instanceof DataResidencyError) return "residency";
  if (err instanceof ModelConfigError) return "config";
  if (err instanceof CitationError) return "citation";
  if (err instanceof MismatchError) return "mismatch";
  const message = err instanceof Error ? err.message : "";
  if (message.startsWith("Model returned invalid JSON")) return "invalid-json";
  if (message.startsWith("Model output failed schema validation")) return "schema";
  const status = /^Vertex AI error (\d{3})\b/.exec(message)?.[1];
  if (status) return `provider-${status}`;
  return "unknown";
}

/**
 * Values never outlive the documents they came from: they expire 27 days after the oldest
 * document's upload, a day before the bucket deletes it (28 days). Never later than 27 days from now.
 */
export function expiryFor(files: Pick<StoredFile, "created">[], now: Date): Date {
  const day = 24 * 3600 * 1000;
  const oldest = Math.min(now.getTime(), ...files.map((f) => f.created.getTime()));
  return new Date(oldest + VALUES_EXPIRE_AFTER_DAYS * day);
}

/** Checks the stored files and turns them into documents for the model. */
export function toDocuments(files: StoredFile[], prefix: string, bucket: string): DocumentFile[] {
  if (files.length === 0) throw new HttpsError("failed-precondition", "No documents uploaded for this client.");
  if (files.length > LIMITS.files) throw new HttpsError("failed-precondition", `More than ${LIMITS.files} documents for this client.`);
  return files.map((f) => {
    const file = f.name.slice(prefix.length);
    if (!f.name.startsWith(prefix) || !file || file.includes("/")) throw new HttpsError("failed-precondition", "A document is stored in the wrong place.");
    if (!DOCUMENT_TYPES.includes(f.contentType as DocumentType)) throw new HttpsError("failed-precondition", `${file}: only PDF, JPG and PNG files.`);
    if (f.size > LIMITS.bytesPerFile) throw new HttpsError("failed-precondition", `${file}: larger than 25 MB.`);
    return { file, mimeType: f.contentType as DocumentType, uri: `gs://${bucket}/${f.name}` };
  });
}

export async function handleExtract(
  caller: Caller | undefined,
  input: unknown,
  deps: ExtractDeps,
): Promise<{ ok: true; files: number; flags: number; status: ExtractionRecord["status"] }> {
  const { clientId, client, prefix } = await authorize(caller, input, deps);
  const taxYear = client.taxYear;
  if (typeof taxYear !== "number" || !Number.isInteger(taxYear)) throw new HttpsError("failed-precondition", "The client has no tax year.");
  const files = await deps.listFiles(prefix);
  const docs = toDocuments(files, prefix, deps.bucket);
  // Values would expire at once: the oldest document is about to be deleted.
  if (expiryFor(files, deps.now?.() ?? new Date()) <= (deps.now?.() ?? new Date())) {
    throw new HttpsError("failed-precondition", `Some documents are older than ${VALUES_EXPIRE_AFTER_DAYS} days and are being deleted. Upload them again in a new client.`);
  }

  const model = getModelConfig("extract", deps.env).model;
  const budget = new CostBudget(budgets.extractMaxCostUsd, { requireCost: true, maxCalls: 1 });
  const started = Date.now();
  let data: ExtractedReturn;
  try {
    data = await (deps.extract ?? extractReturn)(docs, { dataClass: "client", clientId, taxYear, env: deps.env, budget });
    if (data.taxpayer.clientId !== clientId || data.taxpayer.taxYear !== taxYear) throw new MismatchError("The output is for another client or tax year.");
    // Every value must cite a document she uploaded (source file and page).
    if (badCitations(data, docs) > 0) throw new CitationError("A value cites a file or page that was not sent.");
  } catch (err) {
    deps.log?.("extract failed", { clientId, files: docs.length, error: errorCategory(err), ms: Date.now() - started });
    throw new HttpsError("internal", "Extraction failed. Try again.");
  }
  const now = deps.now?.() ?? new Date();
  // Rules are code, run on every extraction (SR-19). No previous year on file yet.
  const { flags, status } = runRules({ current: data });
  const saved = await deps.saveExtraction(clientId, {
    data,
    flags,
    status,
    model,
    taxYear,
    sources: docs.map((d) => d.file),
    extractedAt: now,
    expireAt: expiryFor(files, now),
  });
  if (!saved) {
    deps.log?.("extract discarded", { clientId, reason: "return no longer open" });
    throw new HttpsError("failed-precondition", "This return is no longer open.");
  }
  // Counts only. Never document text or extracted values in logs.
  deps.log?.("extract ok", { clientId, files: docs.length, flags: flags.length, costUsd: budget.spentUsd, ms: Date.now() - started });
  return { ok: true, files: docs.length, flags: flags.length, status };
}

/**
 * Submitting a return deletes its documents and extracted values (SR-28). Safe to repeat: if the
 * deletion fails after the return is closed, calling it again deletes what is left.
 */
export async function handleSubmit(caller: Caller | undefined, input: unknown, deps: ExtractDeps): Promise<{ ok: true }> {
  const { clientId, prefix } = await authorize(caller, input, deps);
  try {
    await deps.submit(clientId, prefix);
  } catch {
    deps.log?.("submit cleanup failed", { clientId });
    throw new HttpsError("unavailable", "The return is submitted, but deleting its documents failed. Try again.");
  }
  deps.log?.("submitted", { clientId });
  return { ok: true };
}

/** She approves the return after her review (SR-20): status Ready to fill. */
export async function handleApprove(caller: Caller | undefined, input: unknown, deps: ExtractDeps): Promise<{ ok: true }> {
  const { clientId } = await authorize(caller, input, deps);
  if (!(await deps.approve(clientId))) throw new HttpsError("failed-precondition", "Only a return with read documents, not yet submitted, can be approved.");
  deps.log?.("approved", { clientId });
  return { ok: true };
}

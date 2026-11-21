import { logger, setGlobalOptions } from "firebase-functions/v2";
import { onCall, onRequest, type CallableRequest } from "firebase-functions/v2/https";
import budgets from "../../budgets.json" with { type: "json" };
import { onSchedule } from "firebase-functions/v2/scheduler";
import { runCleanup } from "./cleanup.js";
import { cleanupDeps, firebaseDeps } from "./deps.js";
import { handleApprove, handleExtract, handleSubmit, type Caller } from "./extract.js";

// Stack is locked: Cloud Functions in europe-west6 (Zurich). See ARCHITECTURE.md.
export const REGION = "europe-west6";
// Budget: no function may run longer than budgets.json allows. Hosting cuts rewrites at ~60 s.
setGlobalOptions({ region: REGION, maxInstances: 5, timeoutSeconds: budgets.functionMaxSeconds });

/** Health check. Used by infra.yml after deploy. Holds no data. */
export const health = onRequest({ timeoutSeconds: 10 }, (_req, res) => {
  res.json({ ok: true, region: REGION });
});

const deps = () => firebaseDeps((message, fields) => logger.info(message, fields));

function caller(req: CallableRequest): Caller | undefined {
  if (!req.auth) return undefined;
  return { uid: req.auth.uid, email: req.auth.token.email, emailVerified: req.auth.token.email_verified };
}

// Runs as extract-fn: Vertex user, Firestore user, and object admin on the documents bucket only.
const callable = { serviceAccount: "extract-fn@", maxInstances: 2 } as const;

/** Extracts one client's return from the documents she uploaded (SR-28). */
export const extract = onCall(callable, (req) => handleExtract(caller(req), req.data, deps()));

/** She approves the return after review: status Ready to fill (SR-20). */
export const approveReturn = onCall(callable, (req) => handleApprove(caller(req), req.data, deps()));

/** Marks a return submitted and deletes its documents and extracted values. */
export const submitReturn = onCall(callable, (req) => handleSubmit(caller(req), req.data, deps()));

/** Daily cleanup (SR-28): retries deletions after submit, removes expired values and documents. */
export const dailyCleanup = onSchedule(
  { schedule: "every day 02:30", timeZone: "Europe/Zurich", serviceAccount: "extract-fn@", maxInstances: 1, retryCount: 3 },
  async () => {
    await runCleanup(cleanupDeps((message, fields) => logger.info(message, fields)));
  },
);

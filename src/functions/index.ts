import { logger, setGlobalOptions } from "firebase-functions/v2";
import { onCall, onRequest, type CallableRequest } from "firebase-functions/v2/https";
import budgets from "../../budgets.json" with { type: "json" };
import { firebaseDeps } from "./deps.js";
import { handleExtract, handleSubmit, type Caller } from "./extract.js";

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

/** Marks a return submitted and deletes its documents and extracted values. */
export const submitReturn = onCall(callable, (req) => handleSubmit(caller(req), req.data, deps()));

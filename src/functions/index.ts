import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger, setGlobalOptions } from "firebase-functions/v2";
import { onCall, onRequest, type CallableRequest } from "firebase-functions/v2/https";
import budgets from "../../budgets.json" with { type: "json" };
import { handleExtract, handleSave, type Caller, type ExtractDeps } from "./extract.js";

// Stack is locked: Cloud Functions in europe-west6 (Zurich). See ARCHITECTURE.md.
export const REGION = "europe-west6";
// Budget: no function may run longer than budgets.json allows. Hosting cuts rewrites at ~60 s.
setGlobalOptions({ region: REGION, maxInstances: 5, timeoutSeconds: budgets.functionMaxSeconds });

/** Health check. Used by infra.yml after deploy. Holds no data. */
export const health = onRequest({ timeoutSeconds: 10 }, (_req, res) => {
  res.json({ ok: true, region: REGION });
});

function deps(): ExtractDeps {
  if (getApps().length === 0) initializeApp();
  const clients = getFirestore().collection("clients");
  return {
    env: process.env,
    getOwner: async (id) => (await clients.doc(id).get()).get("ownerUid") as string | undefined,
    markExtracted: async (id, dataFileId) => {
      await clients.doc(id).update({ dataFileId, extractedAt: FieldValue.serverTimestamp() });
    },
    log: (message, fields) => logger.info(message, fields),
  };
}

function caller(req: CallableRequest): Caller | undefined {
  if (!req.auth) return undefined;
  return { uid: req.auth.uid, email: req.auth.token.email, emailVerified: req.auth.token.email_verified };
}

// Runs as extract-fn (Vertex user and Firestore user only). Lucas creates it (ARCHITECTURE.md).
const callable = { serviceAccount: "extract-fn@", maxInstances: 2 } as const;

/** Extracts one client's return from the text of her PDFs (SR-18). */
export const extract = onCall(callable, (req) => handleExtract(caller(req), req.data, deps()));

/** Records the data file she saved in her Drive. */
export const saveExtraction = onCall(callable, (req) => handleSave(caller(req), req.data, deps()));

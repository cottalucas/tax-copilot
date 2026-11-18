import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";

// Stack is locked: Cloud Functions in europe-west6 (Zurich). See ARCHITECTURE.md.
export const REGION = "europe-west6";
setGlobalOptions({ region: REGION, maxInstances: 5 });

/** Health check. Used by infra.yml after deploy. Holds no data. */
export const health = onRequest((_req, res) => {
  res.json({ ok: true, region: REGION });
});

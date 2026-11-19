import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import budgets from "../../budgets.json" with { type: "json" };

// Stack is locked: Cloud Functions in europe-west6 (Zurich). See ARCHITECTURE.md.
export const REGION = "europe-west6";
// Budget: no function may run longer than budgets.json allows. Hosting cuts rewrites at ~60 s.
setGlobalOptions({ region: REGION, maxInstances: 5, timeoutSeconds: budgets.functionMaxSeconds });

/** Health check. Used by infra.yml after deploy. Holds no data. */
export const health = onRequest({ timeoutSeconds: 10 }, (_req, res) => {
  res.json({ ok: true, region: REGION });
});

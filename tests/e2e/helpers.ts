import type { Page } from "@playwright/test";

const PROJECT = "demo-tax-copilot";
const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = "http://127.0.0.1:8080";
const STORAGE = "http://127.0.0.1:9199";
export const BUCKET = "demo-tax-copilot.appspot.com";
const OWNER = { Authorization: "Bearer owner" };

/** Empties the Auth, Firestore and Storage emulators. */
export async function resetEmulators() {
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  for (const name of await listObjects("")) {
    await fetch(`${STORAGE}/v0/b/${BUCKET}/o/${encodeURIComponent(name)}`, { method: "DELETE", headers: OWNER });
  }
}

/** Object names in the Storage emulator under a prefix, bypassing rules. */
export async function listObjects(prefix: string): Promise<string[]> {
  const res = await fetch(`${STORAGE}/v0/b/${BUCKET}/o?prefix=${encodeURIComponent(prefix)}`, { headers: OWNER });
  if (!res.ok) return [];
  const json = (await res.json()) as { items?: { name: string }[] };
  return (json.items ?? []).map((i) => i.name).sort();
}

/** Signs in through the Auth emulator with a Google identity (test builds only, no popup). */
export async function signInWithGoogle(page: Page, email = "preparer@example.com") {
  await page.waitForFunction(() => "__tcSignIn" in window);
  await page.evaluate((e) => (window as unknown as { __tcSignIn: (x: string) => Promise<unknown> }).__tcSignIn(e), email);
}

/** The uid of the only signed up user in the Auth emulator. */
export async function onlyUid(): Promise<string> {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, { method: "POST", headers: { ...OWNER, "content-type": "application/json" }, body: "{}" });
  const json = (await res.json()) as { userInfo?: { localId: string }[] };
  return json.userInfo?.[0]?.localId ?? "";
}

/** Writes a client document, bypassing rules (emulator owner token). */
export async function seedClient(
  id: string,
  fields: { ownerUid: string; displayName: string; status: string; flagCount: number; taxYear?: number; extracted?: boolean },
) {
  await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/clients/${id}`, {
    method: "PATCH",
    headers: { ...OWNER, "content-type": "application/json" },
    body: JSON.stringify({
      fields: {
        ownerUid: { stringValue: fields.ownerUid },
        displayName: { stringValue: fields.displayName },
        status: { stringValue: fields.status },
        flagCount: { integerValue: String(fields.flagCount) },
        ...(fields.taxYear ? { taxYear: { integerValue: String(fields.taxYear) } } : {}),
        ...(fields.extracted ? { extractedAt: { timestampValue: new Date().toISOString() } } : {}),
      },
    }),
  });
}

/** Reads a client document from the Firestore emulator, bypassing rules. */
export async function readClients(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/clients`, { headers: OWNER });
  const json = (await res.json()) as { documents?: { fields: Record<string, Record<string, unknown>> }[] };
  return (json.documents ?? []).map((d) => Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, Object.values(v)[0]])));
}

/** What the extract function records on success: extractedAt on the client (bypassing rules). */
export async function markExtracted(id: string) {
  await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/clients/${id}?updateMask.fieldPaths=extractedAt`, {
    method: "PATCH",
    headers: { ...OWNER, "content-type": "application/json" },
    body: JSON.stringify({ fields: { extractedAt: { timestampValue: new Date().toISOString() } } }),
  });
}

/** Mocks the extract callable function (the emulator URL). `reply` decides each answer. */
export async function mockExtract(page: Page, reply: (clientId: string) => Promise<{ status?: number; json: unknown }>) {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
  const calls: { auth: string | null; clientId: string }[] = [];
  await page.route("http://127.0.0.1:5001/demo-tax-copilot/europe-west6/extract", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const clientId = String(route.request().postDataJSON().data.clientId);
    calls.push({ auth: await route.request().headerValue("authorization"), clientId });
    const { status = 200, json } = await reply(clientId);
    await route.fulfill({ status, headers: cors, json });
  });
  return calls;
}

/** Records every request to a host other than the app, the emulators and Google's sign-in scripts. */
export function watchOutsideHosts(page: Page): string[] {
  const outside: string[] = [];
  const allowed = (host: string) => ["localhost", "127.0.0.1", "apis.google.com"].includes(host) || host.endsWith(".gstatic.com");
  page.on("request", (r) => {
    const host = new URL(r.url()).hostname;
    if (!allowed(host)) outside.push(host);
  });
  return outside;
}

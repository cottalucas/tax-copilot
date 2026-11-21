import type { Page } from "@playwright/test";

const PROJECT = "demo-tax-copilot";
const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = "http://127.0.0.1:8080";
const OWNER = { Authorization: "Bearer owner" };

/** Empties the Auth and Firestore emulators. */
export async function resetEmulators() {
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
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
  fields: { ownerUid: string; displayName: string; status: string; flagCount: number; driveFolderId?: string; dataFileId?: string },
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
        ...(fields.driveFolderId ? { driveFolderId: { stringValue: fields.driveFolderId } } : {}),
        ...(fields.dataFileId ? { dataFileId: { stringValue: fields.dataFileId } } : {}),
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

/** What the extract function would record: the data file id, written as the server does (bypassing rules). */
export async function markExtracted(id: string, dataFileId: string) {
  await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/clients/${id}?updateMask.fieldPaths=dataFileId&updateMask.fieldPaths=extractedAt`, {
    method: "PATCH",
    headers: { ...OWNER, "content-type": "application/json" },
    body: JSON.stringify({ fields: { dataFileId: { stringValue: dataFileId }, extractedAt: { timestampValue: new Date().toISOString() } } }),
  });
}

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

/** Signs in through the Auth emulator's Google popup. */
export async function signInWithGoogle(page: Page, email = "preparer@example.com") {
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  const emailInput = popup.locator("#email-input");
  // With existing accounts the emulator lists them first; the form sits behind "Add new account".
  if (!(await emailInput.isVisible())) await popup.locator("button.mdc-button--outlined").first().click();
  await emailInput.fill(email);
  await popup.locator("#display-name-input").fill("Preparer");
  await popup.locator("#sign-in").click();
}

/** The uid of the only signed up user in the Auth emulator. */
export async function onlyUid(): Promise<string> {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, { method: "POST", headers: { ...OWNER, "content-type": "application/json" }, body: "{}" });
  const json = (await res.json()) as { userInfo?: { localId: string }[] };
  return json.userInfo?.[0]?.localId ?? "";
}

/** Writes a client document, bypassing rules (emulator owner token). */
export async function seedClient(id: string, fields: { ownerUid: string; displayName: string; status: string; flagCount: number }) {
  await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/clients/${id}`, {
    method: "PATCH",
    headers: { ...OWNER, "content-type": "application/json" },
    body: JSON.stringify({
      fields: {
        ownerUid: { stringValue: fields.ownerUid },
        displayName: { stringValue: fields.displayName },
        status: { stringValue: fields.status },
        flagCount: { integerValue: String(fields.flagCount) },
      },
    }),
  });
}

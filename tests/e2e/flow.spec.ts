import { expect, test } from "@playwright/test";
import { textPdf } from "../../evals/lib/pdf.js";
import { readClients, resetEmulators, signInWithGoogle } from "./helpers.js";

// The real path, nothing mocked in the app: browser upload to Storage, the extract function on
// the functions emulator (allow list, owner, Storage listing, schema, citations), values saved in
// Firestore, the queue. Only the model is a fake Vertex endpoint with a synthetic answer
// (tests/e2e/fake-vertex.ts).
test.beforeEach(async () => {
  await resetEmulators();
});

test("SR-28: upload, then the real extract function reads the documents and saves the values", async ({ page }) => {
  await page.goto("/");
  await signInWithGoogle(page);
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByLabel("Client name").fill("Ana Example");
  await page.getByLabel("Tax year").selectOption(String(new Date().getFullYear() - 1));
  await page.getByLabel("Choose documents").setInputFiles([{ name: "salary.pdf", mimeType: "application/pdf", buffer: textPdf(["Salary statement (synthetic)\nGross salary 76400.00"]) }]);
  await page.getByRole("button", { name: "Create client" }).click();

  await expect(page.getByRole("status")).toHaveText("Ana Example: documents read.", { timeout: 30_000 });
  const row = page.locator("tbody tr", { hasText: "Ana Example" });
  await expect(row.locator("td").nth(3)).toHaveText("Extracted");
  // SR-19: the rules ran on the server; no flags, so Ready to fill.
  await expect(row.locator("td").nth(1)).toHaveText("Ready to fill");
  const [client] = await readClients();
  expect(client!.extractedAt).toBeDefined();
  expect(client).toMatchObject({ status: "ready_to_fill", flagCount: "0" });
  // The values, as the function saved them (read bypassing rules).
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/demo-tax-copilot/databases/(default)/documents/clients/${encodeURIComponent(await clientId())}/extraction/current`, { headers: { Authorization: "Bearer owner" } });
  const doc = (await res.json()) as { fields: Record<string, unknown> };
  expect(JSON.stringify(doc.fields.data)).toContain('"salary.pdf"');
  expect(JSON.stringify(doc.fields.sources)).toContain("salary.pdf");
});

async function clientId(): Promise<string> {
  const res = await fetch("http://127.0.0.1:8080/v1/projects/demo-tax-copilot/databases/(default)/documents/clients", { headers: { Authorization: "Bearer owner" } });
  const json = (await res.json()) as { documents: { name: string }[] };
  return json.documents[0]!.name.split("/").pop()!;
}

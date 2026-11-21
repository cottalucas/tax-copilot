import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { textPdf } from "../../evals/lib/pdf.js";
import { listObjects, markExtracted, mockExtract, onlyUid, readClients, resetEmulators, seedClient, signInWithGoogle, watchOutsideHosts } from "./helpers.js";

// Synthetic documents only (AGENTS.md > Never do): a generated text PDF and the synthetic photo.
const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: textPdf(["Salary statement (synthetic)\nGross salary 98000.00"]) });
const photo = { name: "pillar3a.jpg", mimeType: "image/jpeg", buffer: readFileSync("evals/media/files/photo-pillar3a.jpg") };
const taxYear = String(new Date().getFullYear() - 1);

test.beforeEach(async () => {
  await resetEmulators();
});

test("SR-28: create a client, files land only in her folder of the bucket, the server reads them", async ({ page }) => {
  const outside = watchOutsideHosts(page);
  const calls = await mockExtract(page, async (clientId) => {
    await markExtracted(clientId);
    return { json: { result: { ok: true, files: 3 } } };
  });

  await page.goto("/");
  await signInWithGoogle(page);
  await expect(page.getByRole("heading", { name: "No clients yet" })).toBeVisible();
  await page.getByRole("button", { name: "New client" }).click();

  await page.getByLabel("Client name").fill("Ana Example");
  await page.getByLabel("Tax year").selectOption(taxYear);
  await page.getByLabel("Choose documents").setInputFiles([pdf("salary-statement.pdf"), photo, pdf("salary-statement.pdf")]);
  await expect(page.locator("ul.files li")).toHaveText(["salary-statement.pdf", "pillar3a.jpg", "salary-statement.pdf"]);
  await page.getByRole("button", { name: "Create client" }).click();

  // Back on the queue: Documents in, values extracted, and a notice.
  await expect(page.getByRole("status")).toHaveText("Ana Example: documents read.");
  const row = page.locator("tbody tr", { hasText: "Ana Example" });
  await expect(row.locator("td").nth(1)).toHaveText("Documents in");
  await expect(row.locator("td").nth(3)).toHaveText("Extracted");

  // Files: in her own folder, one unique name each (the names citations use), nowhere else.
  const uid = await onlyUid();
  const [client] = await readClients();
  expect(await listObjects("")).toEqual(
    [`users/${uid}/clients/${calls[0]!.clientId}/pillar3a.jpg`, `users/${uid}/clients/${calls[0]!.clientId}/salary-statement (2).pdf`, `users/${uid}/clients/${calls[0]!.clientId}/salary-statement.pdf`].sort(),
  );
  // Firestore: the client record with the tax year she chose. The server added extractedAt.
  expect(client).toMatchObject({ displayName: "Ana Example", status: "documents_in", fileCount: "3", flagCount: "0", taxYear });
  expect(Object.keys(client!).sort()).toEqual(["createdAt", "displayName", "extractedAt", "fileCount", "flagCount", "ownerUid", "status", "taxYear"]);
  // The extract function was asked once, with her sign-in. No PDF text step in the browser.
  expect(calls).toHaveLength(1);
  expect(calls[0]!.auth).toMatch(/^Bearer /);
  expect(outside).toEqual([]);
});

test("SR-28: if reading fails after upload, the client is kept and Extract all retries", async ({ page }) => {
  let fail = true;
  const calls = await mockExtract(page, async (clientId) => {
    if (fail) return { status: 500, json: { error: { status: "INTERNAL", message: "Extraction failed. Try again." } } };
    await markExtracted(clientId);
    return { json: { result: { ok: true, files: 1 } } };
  });

  await page.goto("/");
  await signInWithGoogle(page);
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByLabel("Client name").fill("Bo Example");
  await page.getByLabel("Tax year").selectOption(taxYear);
  await page.getByLabel("Choose documents").setInputFiles([pdf("statement.pdf")]);
  await page.getByRole("button", { name: "Create client" }).click();

  await expect(page.getByRole("status")).toHaveText("Bo Example: documents uploaded. Extraction failed. Try again. Use Extract all to retry.");
  const row = page.locator("tbody tr", { hasText: "Bo Example" });
  await expect(row.locator("td").nth(3)).toHaveText("Not yet");

  fail = false;
  await page.getByRole("button", { name: "Extract all (1)" }).click();
  await expect(page.getByRole("status")).toHaveText("Documents read for 1 of 1 clients.");
  await expect(row.locator("td").nth(3)).toHaveText("Extracted");
  await expect(page.getByRole("button", { name: /Extract all/ })).toHaveCount(0);
  expect(calls).toHaveLength(2);
});

test("SR-18: Extract all reads every waiting client and reports failures by name", async ({ page }) => {
  const calls = await mockExtract(page, async (clientId) => {
    if (clientId === "c2") return { status: 500, json: { error: { status: "INTERNAL", message: "Extraction failed. Try again." } } };
    await markExtracted(clientId);
    return { json: { result: { ok: true, files: 1 } } };
  });
  await page.goto("/");
  await signInWithGoogle(page);
  const uid = await onlyUid();
  await seedClient("c1", { ownerUid: uid, displayName: "Ana Example", status: "documents_in", flagCount: 0, taxYear: 2025 });
  await seedClient("c2", { ownerUid: uid, displayName: "Bo Example", status: "documents_in", flagCount: 0, taxYear: 2025 });
  await seedClient("c3", { ownerUid: uid, displayName: "Cy Example", status: "documents_in", flagCount: 0, taxYear: 2025, extracted: true });
  await page.reload();

  await page.getByRole("button", { name: "Extract all (2)" }).click();
  await expect(page.getByRole("status")).toHaveText("Documents read for 1 of 2 clients.");
  await expect(page.getByRole("alert")).toContainText("Bo Example: Extraction failed. Try again.");
  expect(calls.map((c) => c.clientId)).toEqual(["c1", "c2"]);
  await page.getByRole("button", { name: "Refresh the queue" }).click();
  await expect(page.locator("tbody tr", { hasText: "Ana Example" }).locator("td").nth(3)).toHaveText("Extracted");
  await expect(page.locator("tbody tr", { hasText: "Bo Example" }).locator("td").nth(3)).toHaveText("Not yet");
});

test("SR-28: name, tax year and documents are required, other files are rejected", async ({ page }) => {
  await page.goto("/");
  await signInWithGoogle(page);
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a client name.");
  await page.getByLabel("Client name").fill("Ana Example");
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByRole("alert")).toContainText("Choose the tax year.");
  await page.getByLabel("Tax year").selectOption(taxYear);
  await page.getByLabel("Choose documents").setInputFiles([{ name: "anim.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") }]);
  await expect(page.getByRole("alert")).toContainText("anim.gif: only PDF, JPG and PNG files.");
  await page.getByLabel("Choose documents").setInputFiles([{ name: "renamed.pdf", mimeType: "application/pdf", buffer: Buffer.from("not really a pdf") }]);
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByRole("alert")).toContainText("renamed.pdf: not a valid PDF file.");
  await page.getByLabel("Choose documents").setInputFiles([]);
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByRole("alert")).toContainText("Add at least one document.");
  expect(await readClients()).toEqual([]);
  expect(await listObjects("")).toEqual([]);
});

import { expect, test } from "@playwright/test";
import { readClients, resetEmulators, signInWithGoogle } from "./helpers.js";

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 synthetic test file") });

test.beforeEach(async () => {
  await resetEmulators();
});

test("SR-17: create a client, files go to her Drive only, status Documents in", async ({ page }) => {
  // Mock Google Drive. Record every outside request to prove files go nowhere else.
  const drive: { url: string; auth: string | null; body: string }[] = [];
  await page.route("https://www.googleapis.com/drive/v3/files**", async (route) => {
    drive.push({ url: route.request().url(), auth: route.request().headerValue ? await route.request().headerValue("authorization") : null, body: route.request().postData() ?? "" });
    await route.fulfill({ json: { id: "folder123" } });
  });
  let uploads = 0;
  await page.route("https://www.googleapis.com/upload/drive/v3/files**", async (route) => {
    uploads += 1;
    drive.push({ url: route.request().url(), auth: await route.request().headerValue("authorization"), body: route.request().postData() ?? "" });
    await route.fulfill({ json: { id: `file${uploads}` } });
  });
  const outside: string[] = [];
  // Allowed: the app itself, the emulators, Google Drive, and Google's sign-in helper scripts.
  const allowed = (host: string) => ["localhost", "127.0.0.1", "www.googleapis.com", "apis.google.com"].includes(host) || host.endsWith(".gstatic.com");
  page.on("request", (r) => {
    const host = new URL(r.url()).hostname;
    if (!allowed(host)) outside.push(host);
  });

  await page.goto("/");
  await signInWithGoogle(page);
  await expect(page.getByRole("heading", { name: "No clients yet" })).toBeVisible();
  await page.getByRole("button", { name: "New client" }).click();

  await page.getByLabel("Client name").fill("Ana Example");
  await page.getByLabel("Choose PDFs").setInputFiles([pdf("salary-statement.pdf"), pdf("bank-statement.pdf")]);
  await expect(page.locator("ul.files li")).toHaveText(["salary-statement.pdf", "bank-statement.pdf"]);
  await page.getByRole("button", { name: "Create client" }).click();

  // Back on the queue: the client shows with status Documents in.
  const row = page.locator("tbody tr", { hasText: "Ana Example" });
  await expect(row).toBeVisible();
  await expect(row.locator("td").nth(1)).toHaveText("Documents in");

  // Files went to her Drive with her token, into the new folder, and nowhere else.
  expect(uploads).toBe(2);
  expect(drive.every((d) => d.auth?.startsWith("Bearer "))).toBe(true);
  expect(drive.filter((d) => d.url.includes("/upload/")).every((d) => d.body.includes('"parents":["folder123"]'))).toBe(true);
  expect(outside).toEqual([]);

  // Firestore holds only the client's status record, with the Drive folder id.
  const [client] = await readClients();
  expect(client).toMatchObject({ displayName: "Ana Example", status: "documents_in", driveFolderId: "folder123", fileCount: "2", flagCount: "0" });
  expect(Object.keys(client!).sort()).toEqual(["createdAt", "displayName", "driveFolderId", "fileCount", "flagCount", "ownerUid", "status"]);
});

test("SR-17: name and files are required, non PDFs are rejected", async ({ page }) => {
  await page.goto("/");
  await signInWithGoogle(page);
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a client name.");
  await page.getByLabel("Client name").fill("Ana Example");
  await page.getByLabel("Choose PDFs").setInputFiles([{ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("png") }]);
  await expect(page.getByRole("alert")).toContainText("photo.png: only PDF files.");
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByRole("alert")).toContainText("Add at least one PDF.");
});

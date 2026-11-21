import { expect, test, type Page, type Route } from "@playwright/test";
import { markExtracted, onlyUid, resetEmulators, seedClient, signInWithGoogle } from "./helpers.js";
import { textPdf } from "./pdf-fixture.js";

// Synthetic documents only (AGENTS.md > Never do).
const taxYear = new Date().getFullYear() - 2;
const salary = textPdf([["Salary statement (synthetic)", "Employer Example AG"], ["Gross salary 98000.00"]]);
const FUNCTIONS = "http://127.0.0.1:5001/demo-tax-copilot/europe-west6";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };

type Call = { auth: string | null; data: Record<string, unknown> };

/** Mocks one callable function. Preflight requests get CORS headers, calls get `reply`. */
async function mockCallable(page: Page, name: string, reply: (call: Call) => Promise<{ status?: number; json: unknown }>) {
  const calls: Call[] = [];
  await page.route(`${FUNCTIONS}/${name}`, async (route: Route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const call = { auth: await route.request().headerValue("authorization"), data: route.request().postDataJSON().data };
    calls.push(call);
    const { status = 200, json } = await reply(call);
    await route.fulfill({ status, headers: cors, json });
  });
  return calls;
}

/** Mocks her Drive: one folder with one PDF, and optionally a data file from an earlier try. */
async function mockDrive(page: Page, existingDataFile?: string) {
  const uploads: { method: string; path: string; auth: string | null; type: string; body: string }[] = [];
  const reads: string[] = [];
  await page.route("https://www.googleapis.com/drive/v3/files**", async (route) => {
    const url = new URL(route.request().url());
    reads.push(url.pathname + url.search);
    if ((await route.request().headerValue("authorization")) !== "Bearer emulator-drive-token") return route.fulfill({ status: 401, json: {} });
    const query = url.searchParams.get("q") ?? "";
    if (url.pathname.endsWith("/files") && query.includes("name='tax-copilot-data.json'")) {
      return route.fulfill({ json: { files: existingDataFile ? [{ id: existingDataFile }] : [] } });
    }
    if (url.pathname.endsWith("/files") && query.includes("mimeType='application/pdf'")) {
      return route.fulfill({ json: { files: [{ id: "pdf1", name: "salary-statement.pdf" }] } });
    }
    if (url.pathname.endsWith("/files/pdf1") && url.searchParams.get("alt") === "media") return route.fulfill({ body: salary, contentType: "application/pdf" });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.route("https://www.googleapis.com/upload/drive/v3/files**", async (route) => {
    const type = (await route.request().headerValue("content-type")) ?? "";
    if (!type.startsWith("multipart/related; boundary=")) return route.fulfill({ status: 400, json: { error: "bad content type" } });
    const path = new URL(route.request().url()).pathname;
    uploads.push({ method: route.request().method(), path, auth: await route.request().headerValue("authorization"), type, body: route.request().postData() ?? "" });
    await route.fulfill({ json: { id: existingDataFile ?? "data1" } });
  });
  return { uploads, reads };
}

const extracted = {
  schemaVersion: 1,
  taxpayer: { clientId: "c1", taxYear },
  employment: [{ employer: { value: "Example AG", source: { file: "salary-statement.pdf", page: 1 } }, grossSalary: { value: 98000, source: { file: "salary-statement.pdf", page: 2 } } }],
  deductions: {},
  bankAccounts: [],
  cantonSpecific: {},
};

test.beforeEach(async () => {
  await resetEmulators();
});

test("SR-18: extract all reads her PDFs, extracts through the function, saves one data file in her Drive", async ({ page }) => {
  const drive = await mockDrive(page);
  const extractCalls = await mockCallable(page, "extract", async () => ({ json: { result: { data: extracted, model: "test-model" } } }));
  const saveCalls = await mockCallable(page, "saveExtraction", async (call) => {
    await markExtracted(String(call.data.clientId), String(call.data.dataFileId));
    return { json: { result: { ok: true } } };
  });
  const outside: string[] = [];
  const allowed = (host: string) => ["localhost", "127.0.0.1", "www.googleapis.com", "apis.google.com"].includes(host) || host.endsWith(".gstatic.com");
  page.on("request", (r) => {
    const host = new URL(r.url()).hostname;
    if (!allowed(host)) outside.push(host);
  });

  await page.goto("/");
  await signInWithGoogle(page);
  const uid = await onlyUid();
  await seedClient("c1", { ownerUid: uid, displayName: "Ana Example", status: "documents_in", flagCount: 0, driveFolderId: "folder1" });
  await seedClient("c2", { ownerUid: uid, displayName: "Bo Example", status: "documents_in", flagCount: 0, driveFolderId: "folder2", dataFileId: "old" });
  await page.reload();

  const row = page.locator("tbody tr", { hasText: "Ana Example" });
  await expect(row.locator("td").nth(3)).toHaveText("Not yet");
  await expect(page.locator("tbody tr", { hasText: "Bo Example" }).locator("td").nth(3)).toHaveText("Extracted");
  // She must state the tax year: the app never guesses it.
  await page.getByRole("button", { name: "Extract all (1)" }).click();
  await expect(page.getByRole("alert")).toHaveText("Choose the tax year first.");
  expect(extractCalls).toHaveLength(0);
  // Only clients without a data file are waiting.
  await page.getByLabel("Tax year").selectOption(String(taxYear));
  await page.getByRole("button", { name: "Extract all (1)" }).click();

  await expect(page.getByRole("status")).toHaveText("Data extracted for 1 of 1 clients.");
  await expect(row.locator("td").nth(3)).toHaveText("Extracted");
  await expect(page.getByRole("button", { name: /Extract all/ })).toHaveCount(0);

  // The function got the text of every page with its file name, with her Firebase sign-in.
  expect(extractCalls).toHaveLength(1);
  expect(extractCalls[0]!.auth).toMatch(/^Bearer /);
  expect(extractCalls[0]!.data).toEqual({
    clientId: "c1",
    taxYear,
    documents: [{ file: "salary-statement.pdf", pages: ["Salary statement (synthetic)\nEmployer Example AG", "Gross salary 98000.00"] }],
  });
  // Drive: listed only that client's folder, and saved one data file into it with her token.
  expect(drive.reads.some((r) => r.includes("folder2"))).toBe(false);
  expect(drive.uploads).toHaveLength(1);
  expect(drive.uploads[0]!.method).toBe("POST");
  expect(drive.uploads[0]!.auth).toBe("Bearer emulator-drive-token");
  expect(drive.uploads[0]!.body).toContain('{"name":"tax-copilot-data.json","parents":["folder1"]}');
  expect(drive.uploads[0]!.body).toContain('"model": "test-model"');
  expect(drive.uploads[0]!.body).toContain('"page": 2');
  const saved = JSON.parse(drive.uploads[0]!.body.split("\r\n\r\n")[2]!.split("\r\n--")[0]!);
  expect(saved.taxYear).toBe(taxYear);
  expect(saved.data.taxpayer.taxYear).toBe(taxYear);
  expect(saved.sources).toEqual([{ file: "salary-statement.pdf", driveFileId: "pdf1" }]);
  expect(saveCalls.map((c) => c.data)).toEqual([{ clientId: "c1", dataFileId: "data1" }]);
  expect(outside).toEqual([]);
});

test("SR-18: a failed extraction is reported and nothing is saved", async ({ page }) => {
  const drive = await mockDrive(page);
  await mockCallable(page, "extract", async () => ({ status: 500, json: { error: { status: "INTERNAL", message: "Extraction failed. Try again." } } }));
  const saveCalls = await mockCallable(page, "saveExtraction", async () => ({ json: { result: { ok: true } } }));

  await page.goto("/");
  await signInWithGoogle(page);
  await seedClient("c1", { ownerUid: await onlyUid(), displayName: "Ana Example", status: "documents_in", flagCount: 0, driveFolderId: "folder1" });
  await page.reload();
  await page.getByLabel("Tax year").selectOption(String(taxYear));
  await page.getByRole("button", { name: "Extract all (1)" }).click();

  await expect(page.getByRole("status")).toHaveText("Data extracted for 0 of 1 clients.");
  await expect(page.getByRole("alert")).toContainText("Ana Example: Extraction failed. Try again.");
  expect(drive.uploads).toHaveLength(0);
  expect(saveCalls).toHaveLength(0);
  await page.getByRole("button", { name: "Refresh the queue" }).click();
  await expect(page.locator("tbody tr", { hasText: "Ana Example" }).locator("td").nth(3)).toHaveText("Not yet");
});

test("SR-18: a retry overwrites the data file from an earlier try instead of adding a second one", async ({ page }) => {
  const drive = await mockDrive(page, "data0");
  await mockCallable(page, "extract", async () => ({ json: { result: { data: extracted, model: "test-model" } } }));
  const saveCalls = await mockCallable(page, "saveExtraction", async (call) => {
    await markExtracted(String(call.data.clientId), String(call.data.dataFileId));
    return { json: { result: { ok: true } } };
  });

  await page.goto("/");
  await signInWithGoogle(page);
  await seedClient("c1", { ownerUid: await onlyUid(), displayName: "Ana Example", status: "documents_in", flagCount: 0, driveFolderId: "folder1" });
  await page.reload();
  await page.getByLabel("Tax year").selectOption(String(taxYear));
  await page.getByRole("button", { name: "Extract all (1)" }).click();

  await expect(page.getByRole("status")).toHaveText("Data extracted for 1 of 1 clients.");
  expect(drive.uploads.map((u) => [u.method, u.path])).toEqual([["PATCH", "/upload/drive/v3/files/data0"]]);
  expect(saveCalls.map((c) => c.data)).toEqual([{ clientId: "c1", dataFileId: "data0" }]);
});

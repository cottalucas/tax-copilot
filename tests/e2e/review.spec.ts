import { expect, test } from "@playwright/test";
import { textPdf } from "../../evals/lib/pdf.js";
import { mockCallable, onlyUid, resetEmulators, seedClient, seedExtraction, setStatus, signInWithGoogle } from "./helpers.js";

// Synthetic values only (AGENTS.md > Never do).
const s = (page: number) => ({ file: "salary.pdf", page });
const data = {
  schemaVersion: 1,
  taxpayer: { clientId: "c1", taxYear: 2025 },
  employment: [{ employer: { value: "Synthetic AG", source: s(1) }, grossSalary: { value: 76400, source: s(1) }, netSalary: { value: 80000, source: s(2) } }],
  deductions: { pillar3a: { value: 7056, source: s(2) } },
  bankAccounts: [],
  cantonSpecific: {},
};
const flags = [{ ruleId: "net-above-gross", severity: "critical", field: "employment.0.netSalary", reason: "The net salary from Synthetic AG is higher than the gross salary. Check the source page." }];

test.beforeEach(async () => {
  await resetEmulators();
});

test("SR-20: review shows flags first, then totals, then changes; a value opens its source page; Approve sets Ready to fill", async ({ page }) => {
  // Headless Chromium has no PDF viewer, so record where the app sends the new tab instead.
  await page.addInitScript(() => {
    const w = window as unknown as { __opened: string[] };
    w.__opened = [];
    window.open = () => ({ location: { set href(v: string) { w.__opened.push(v); } }, close() {} }) as unknown as Window;
  });
  const approvals = await mockCallable(page, "approveReturn", async (d) => {
    await setStatus(String(d.clientId), "ready_to_fill");
    return { json: { result: { ok: true } } };
  });
  await page.goto("/");
  await signInWithGoogle(page);
  const uid = await onlyUid();
  await seedClient("c1", { ownerUid: uid, displayName: "Ana Example", status: "documents_in", flagCount: 0, taxYear: 2025 });
  await seedExtraction("c1", uid, { status: "needs_review", data, flags, file: { name: "salary.pdf", body: textPdf(["Page one", "Page two"]), contentType: "application/pdf" } });
  await page.reload();

  await page.getByRole("button", { name: "Ana Example" }).click();
  await expect(page.getByRole("heading", { name: "Ana Example, tax year 2025" })).toBeVisible();
  // Order: flags, key totals, changes from last year.
  await expect(page.locator(".review h2")).toHaveText(["Ana Example, tax year 2025", "Flags (1)", "Key totals", "Changes from last year"]);
  await expect(page.locator(".flag-card")).toContainText("Critical");
  await expect(page.locator(".flag-card")).toContainText("higher than the gross salary");
  await expect(page.locator("tbody tr").first()).toContainText("Gross salary, Synthetic AG");
  await expect(page.locator("tbody tr").first()).toContainText("CHF 76'400.00");
  await expect(page.getByText("Not found in the documents: Insurance premiums, Public transport, Commute distance, Childcare, Bank accounts.")).toBeVisible();

  // The flagged value opens its own page of the source PDF, loaded with her sign-in (a blob, not a link).
  await page.locator(".flag-card").getByRole("button", { name: "salary.pdf, page 2" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened[0] ?? "")).toMatch(/^blob:http.*#page=2$/);
  const head = await page.evaluate(async () => {
    const url = (window as unknown as { __opened: string[] }).__opened[0]!.split("#")[0]!;
    return new TextDecoder().decode((await (await fetch(url)).arrayBuffer()).slice(0, 5));
  });
  expect(head).toBe("%PDF-");

  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Ana Example: approved, ready to fill.");
  await expect(page.locator("tbody tr", { hasText: "Ana Example" }).locator("td").nth(1)).toHaveText("Ready to fill");
  expect(approvals).toEqual([{ clientId: "c1" }]);
});

test("SR-20: a clean return says so, and a return not yet read points back to Extract all", async ({ page }) => {
  await page.goto("/");
  await signInWithGoogle(page);
  const uid = await onlyUid();
  await seedClient("c1", { ownerUid: uid, displayName: "Bo Example", status: "documents_in", flagCount: 0, taxYear: 2025 });
  await seedExtraction("c1", uid, { status: "ready_to_fill", data, flags: [] });
  await page.reload();
  await page.getByRole("button", { name: "Bo Example" }).click();
  await expect(page.getByText("No flags. Check totals and approve.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve again" })).toBeVisible();
});

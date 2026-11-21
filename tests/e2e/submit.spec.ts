import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mockCallable, onlyUid, resetEmulators, seedClient, seedExtraction, setStatus, signInWithGoogle } from "./helpers.js";

// Synthetic values only (AGENTS.md > Never do).
const src = { file: "salary.pdf", page: 1 };
const data = (clientId: string) => ({
  schemaVersion: 1,
  taxpayer: { clientId, taxYear: 2025 },
  employment: [{ employer: { value: "Synthetic AG", source: src }, grossSalary: { value: 50000, source: src } }],
  deductions: {},
  bankAccounts: [],
  cantonSpecific: {},
});

test.beforeEach(async () => {
  await resetEmulators();
});

test("SR-22: mark as submitted after a confirm, then go to the next client", async ({ page }) => {
  const submits = await mockCallable(page, "submitReturn", async (d) => {
    await setStatus(String(d.clientId), "submitted");
    return { json: { result: { ok: true } } };
  });
  await page.goto("/");
  await signInWithGoogle(page);
  const uid = await onlyUid();
  await seedClient("c1", { ownerUid: uid, displayName: "Ana Example", status: "documents_in", flagCount: 0, taxYear: 2025 });
  await seedExtraction("c1", uid, { status: "ready_to_fill", data: data("c1"), flags: [] });
  await seedClient("c2", { ownerUid: uid, displayName: "Bo Example", status: "documents_in", flagCount: 0, taxYear: 2025 });
  await seedExtraction("c2", uid, { status: "needs_review", data: data("c2"), flags: [{ ruleId: "no-salary-statement", severity: "warning", field: "employment", reason: "Check it." }] });
  await page.reload();

  await page.getByRole("button", { name: "Ana Example" }).click();
  // Cancel leaves everything as it was.
  await page.getByRole("button", { name: "Mark as submitted" }).click();
  await expect(page.getByText("This deletes the client's documents and extracted values.")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("This deletes the client's documents and extracted values.")).toBeHidden();
  expect(submits).toEqual([]);

  await page.getByRole("button", { name: "Mark as submitted" }).click();
  await page.getByRole("button", { name: "Yes, mark as submitted" }).click();
  await expect(page.getByRole("heading", { name: "Ana Example: submitted" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Marked as submitted. Its documents and extracted values are deleted.");
  expect(submits).toEqual([{ clientId: "c1" }]);
  const after = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(after.violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("button", { name: "Next client: Bo Example" }).click();
  await expect(page.getByRole("heading", { name: "Bo Example, tax year 2025" })).toBeVisible();
  // A return under review cannot be marked submitted before it is approved.
  await expect(page.getByRole("button", { name: "Mark as submitted" })).toHaveCount(0);
});

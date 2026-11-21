import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockExtract, onlyUid, resetEmulators, seedClient, signInWithGoogle } from "./helpers.js";

// Accessibility gate (DESIGN.md: WCAG 2.2 AA). Every screen and state gets a check.
async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
  expect(summary, summary.join("\n")).toEqual([]);
}

test.beforeEach(async () => {
  await resetEmulators();
});

test("login screen has no WCAG 2.2 AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expectNoViolations(page);
});

test("empty and filled queue have no WCAG 2.2 AA violations", async ({ page }) => {
  await page.goto("/");
  await signInWithGoogle(page);
  await expect(page.getByRole("heading", { name: "No clients yet" })).toBeVisible();
  await expectNoViolations(page);
  await seedClient("c1", { ownerUid: await onlyUid(), displayName: "Cleo Example", status: "needs_review", flagCount: 2 });
  await page.reload();
  await expect(page.locator("section.group")).toHaveCount(1);
  await expectNoViolations(page);
});

test("queue with Extract all and a failed extraction has no WCAG 2.2 AA violations", async ({ page }) => {
  await mockExtract(page, async () => ({ status: 500, json: { error: { status: "FAILED_PRECONDITION", message: "No documents uploaded for this client." } } }));
  await page.goto("/");
  await signInWithGoogle(page);
  await seedClient("c1", { ownerUid: await onlyUid(), displayName: "Ana Example", status: "documents_in", flagCount: 0, taxYear: 2025 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Extract all (1)" })).toBeVisible();
  await expectNoViolations(page);
  await page.getByRole("button", { name: "Extract all (1)" }).click();
  await expect(page.getByRole("alert")).toContainText("No documents uploaded");
  await expectNoViolations(page);
});

test("new client form has no WCAG 2.2 AA violations", async ({ page }) => {
  await page.goto("/");
  await signInWithGoogle(page);
  await page.getByRole("button", { name: "New client" }).click();
  await expect(page.getByRole("heading", { name: "New client" })).toBeVisible();
  await expectNoViolations(page);
});

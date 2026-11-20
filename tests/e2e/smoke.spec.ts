import { expect, test } from "@playwright/test";
import { onlyUid, resetEmulators, seedClient, signInWithGoogle } from "./helpers.js";

test.beforeEach(async () => {
  await resetEmulators();
});

test("signed out: the login screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Tax Copilot");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});

test("SR-16: login, empty queue, then clients grouped by status with flagged first", async ({ page }) => {
  await page.goto("/");
  await signInWithGoogle(page);

  // Empty state when there are zero clients.
  await expect(page.getByRole("heading", { name: "No clients yet" })).toBeVisible();

  const uid = await onlyUid();
  expect(uid).not.toBe("");
  await seedClient("c1", { ownerUid: uid, displayName: "Ana Example", status: "needs_review", flagCount: 0 });
  await seedClient("c2", { ownerUid: uid, displayName: "Cleo Example", status: "needs_review", flagCount: 2 });
  await seedClient("c3", { ownerUid: uid, displayName: "Dan Example", status: "documents_in", flagCount: 0 });
  await seedClient("c4", { ownerUid: "someone-else", displayName: "Not Hers", status: "needs_review", flagCount: 5 });
  await page.reload();

  // Groups in working order, flagged first inside a group.
  const groups = page.locator("section.group h2");
  await expect(groups).toHaveText(["Needs review (2)", "Documents in (1)"]);
  const firstGroupRows = page.locator("section.group").first().locator("tbody tr");
  await expect(firstGroupRows.nth(0)).toContainText("Cleo Example");
  await expect(firstGroupRows.nth(1)).toContainText("Ana Example");

  // Row shows name, status and flag count.
  const cleo = page.locator('tr[data-client="c2"]');
  await expect(cleo.locator("td").nth(0)).toHaveText("Cleo Example");
  await expect(cleo.locator("td").nth(1)).toHaveText("Needs review");
  await expect(cleo.locator("td").nth(2)).toHaveText("2");

  // Another user's client never shows.
  await expect(page.getByText("Not Hers")).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

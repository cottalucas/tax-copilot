import { expect, test } from "@playwright/test";

test("app shell loads with the empty queue", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Tax Copilot");
  await expect(page.getByRole("heading", { name: "Tax Copilot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No clients yet" })).toBeVisible();
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Accessibility gate (DESIGN.md: WCAG 2.2 AA). Add every new screen route to this list.
const ROUTES = ["/"];

for (const route of ROUTES) {
  test(`no WCAG 2.2 AA violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}

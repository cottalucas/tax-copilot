/**
 * Screenshot UX review (AGENTS.md > Pipeline). Comments on the pull request, never blocks.
 * Takes a screenshot of each route, asks a vision model to review it against Nielsen's 10
 * heuristics (skill nielsen-heuristics-audit) and DESIGN.md, and posts one comment.
 * Screens hold no client data, so dataClass is "anonymized".
 * Usage: BASE_URL=http://localhost:4173 PR=<n> tsx scripts/ux-review.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { complete, CostBudget } from "../src/models/index.js";

export const MARKER = "<!-- tax-copilot-ux-review -->";
const ROUTES = ["/"];

export function buildPrompt(heuristics: string, design: string): string {
  return `You review screenshots of Tax Copilot, an expert tool for one professional tax preparer.
Judge them only against Nielsen's 10 usability heuristics and the project's DESIGN.md (below).
Write one GitHub comment in Markdown, under 250 words, plain language, no em dashes:
- One line per screen with the two most important issues, each naming the heuristic.
- Then "Fine as is" for heuristics with no issue.
Do not comment on code. This review does not block the pull request.

## Heuristics
${heuristics}

## DESIGN.md
${design}`;
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:4173";
  const heuristics = readFileSync(".agents/skills/nielsen-heuristics-audit/references/heuristics.md", "utf8").slice(0, 12000);
  const design = readFileSync("DESIGN.md", "utf8").slice(0, 12000);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const shots: string[] = [];
  for (const route of ROUTES) {
    await page.goto(new URL(route, baseUrl).toString());
    shots.push(`data:image/png;base64,${(await page.screenshot({ fullPage: true })).toString("base64")}`);
  }
  await browser.close();

  const model = process.env.UX_REVIEW_MODEL || undefined;
  const result = await complete(
    {
      dataClass: "anonymized",
      model,
      messages: [
        { role: "system", content: buildPrompt(heuristics, design) },
        {
          role: "user",
          content: [
            { type: "text", text: `Screens: ${ROUTES.join(", ")}` },
            ...shots.map((dataUrl) => ({ type: "image" as const, dataUrl })),
          ],
        },
      ],
    },
    { budget: new CostBudget(0.5) },
  );

  const body = `${MARKER}\n### UX review (${result.model}, does not block)\n\n${result.text.trim()}`;
  const { PR, GITHUB_REPOSITORY } = process.env;
  if (!PR || !GITHUB_REPOSITORY) {
    console.log(body);
    return;
  }
  const gh = (args: string[], input?: string) => execFileSync("gh", args, { encoding: "utf8", input });
  const comments = JSON.parse(gh(["api", `repos/${GITHUB_REPOSITORY}/issues/${PR}/comments`, "--paginate"])) as { id: number; body?: string }[];
  const existing = comments.find((c) => c.body?.startsWith(MARKER));
  if (existing) gh(["api", "-X", "PATCH", `repos/${GITHUB_REPOSITORY}/issues/comments/${existing.id}`, "-F", "body=@-"], body);
  else gh(["api", `repos/${GITHUB_REPOSITORY}/issues/${PR}/comments`, "-F", "body=@-"], body);
  console.log("Posted UX review");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
// Builds the reviewer prompt: AGENTS.md rules, the task's acceptance criteria, and the diff.
// Used by the review job in pr.yml. Prints to stdout.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { PR_TITLE = "", PR_BODY = "", HEAD_REF = "", BASE_SHA = "" } = process.env;
const MAX_DIFF = 120_000;

export function findTaskIds(...texts) {
  const ids = new Set();
  for (const t of texts) for (const m of String(t).matchAll(/\bSR-(\d+)\b/gi)) ids.add(`SR-${m[1]}`);
  return [...ids];
}

export const LINEAR_API = "https://api.linear.app/graphql";

/** Fetches a Linear issue's title and description. Returns "" when it cannot. */
export async function fetchLinearIssue(id, apiKey, fetchImpl = globalThis.fetch) {
  if (!apiKey) return "";
  try {
    const res = await fetchImpl(LINEAR_API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: apiKey },
      body: JSON.stringify({
        query: "query($id: String!) { issue(id: $id) { identifier title description } }",
        variables: { id },
      }),
    });
    if (!res.ok) return "";
    const issue = (await res.json())?.data?.issue;
    if (!issue) return "";
    return `### ${issue.identifier}: ${issue.title}\n\n${issue.description ?? ""}`.trim();
  } catch {
    return "";
  }
}

async function main() {
  // Rules come from the trusted base commit (TRUSTED_DIR), never from the pull request itself.
  const trusted = process.env.TRUSTED_DIR || ".";
  const agents = readFileSync(`${trusted}/AGENTS.md`, "utf8");
  // Block rules live in scripts/review-rules.md so they can be tuned in one place.
  const rules = readFileSync(`${trusted}/scripts/review-rules.md`, "utf8");
  // Linear holds the acceptance criteria (TASKS.md only points there). Ids come from title and branch.
  const ids = findTaskIds(PR_TITLE, HEAD_REF);
  const issues = await Promise.all(ids.map((id) => fetchLinearIssue(id, process.env.LINEAR_API_KEY)));
  const criteria = issues.filter(Boolean).join("\n\n") ||
    (ids.length
      ? `Could not read ${ids.join(", ")} from Linear. Say so, and review against AGENTS.md and the pull request body.`
      : "No task id (SR-n) found in the title or branch. Say so, and review against AGENTS.md only.");
  let diff = execFileSync("git", ["diff", "--stat", "--patch", `${BASE_SHA}...HEAD`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (diff.length > MAX_DIFF) diff = diff.slice(0, MAX_DIFF) + "\n[diff truncated]";

  process.stdout.write(`${rules}

## Pull request
Title: ${PR_TITLE}
Branch: ${HEAD_REF}
Body:
${PR_BODY}

## Linked Linear issues
${criteria}

## AGENTS.md
${agents}

## Diff
\`\`\`diff
${diff}
\`\`\`
`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

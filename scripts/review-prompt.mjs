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

export function taskSection(tasksMd, id) {
  const lines = tasksMd.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## ") && l.includes(`(${id})`));
  if (start === -1) return "";
  const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  return lines.slice(start, end === -1 ? undefined : end).join("\n").trim();
}

function main() {
  // Rules come from the trusted base commit (TRUSTED_DIR), never from the pull request itself.
  const trusted = process.env.TRUSTED_DIR || ".";
  const agents = readFileSync(`${trusted}/AGENTS.md`, "utf8");
  const tasks = readFileSync(`${trusted}/TASKS.md`, "utf8");
  const ids = findTaskIds(PR_TITLE, PR_BODY, HEAD_REF);
  const criteria = ids.map((id) => taskSection(tasks, id)).filter(Boolean).join("\n\n") ||
    "No task id (SR-n) found in the title, body or branch. Say so, and review against AGENTS.md only.";
  let diff = execFileSync("git", ["diff", "--stat", "--patch", `${BASE_SHA}...HEAD`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (diff.length > MAX_DIFF) diff = diff.slice(0, MAX_DIFF) + "\n[diff truncated]";

  // Block rules live in scripts/review-rules.md so they can be tuned in one place.
  const rules = readFileSync(`${trusted}/scripts/review-rules.md`, "utf8");
  process.stdout.write(`${rules}

## Pull request
Title: ${PR_TITLE}
Branch: ${HEAD_REF}
Body:
${PR_BODY}

## Linked task
${criteria}

## AGENTS.md
${agents}

## Diff
\`\`\`diff
${diff}
\`\`\`
`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

#!/usr/bin/env node
// Posts the reviewer output as one pull request comment, updating it on later runs.
// Then gates the pull request: blocks only on a tagged criterion, Never rule or security reason.
// No human QA on pull requests (AGENTS.md): a failed review halts the pull request.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const MARKER = "<!-- tax-copilot-review -->";

export const BLOCK_TAGS = ["CRITERION", "NEVER", "SECURITY"];

/** Returns the tagged block reasons, for example [{ tag: "NEVER", text: "src/x.ts:12 ..." }]. */
export function parseBlockReasons(review) {
  const reasons = [];
  for (const m of String(review).matchAll(/^\s*[-*]\s*`?\[(CRITERION|NEVER|SECURITY)\]`?\s*(.+)$/gim)) {
    reasons.push({ tag: m[1].toUpperCase(), text: m[2].trim() });
  }
  return reasons;
}

/**
 * Decides the gate. Approve passes. Changes requested blocks, and must carry at least one tagged
 * reason (criterion, Never rule, security). Malformed output (no verdict, or changes requested
 * without a tag) fails closed.
 */
export function decide(review) {
  const verdict = parseVerdict(review);
  if (verdict === null) return { block: true, reasons: [], note: "Review has no verdict line. Failing closed." };
  const reasons = parseBlockReasons(review);
  if (verdict === "approve") return { block: false, reasons: [], note: "Verdict: Approve" };
  // The rules allow "Changes requested" only with a tagged reason. Without one the output is
  // malformed, so the gate fails closed rather than letting a real blocker through.
  if (reasons.length === 0) return { block: true, reasons, note: "Changes requested without a [CRITERION], [NEVER] or [SECURITY] tag. Malformed review, failing closed." };
  return { block: true, reasons, note: `Blocked: ${reasons.map((r) => `[${r.tag}] ${r.text}`).join(" | ")}` };
}

/** Returns "approve", "changes" or null when the review has no verdict line. */
export function parseVerdict(review) {
  const m = String(review).match(/verdict\s*:\s*\**\s*(approve|changes requested)/i);
  if (!m) return null;
  return m[1].toLowerCase() === "approve" ? "approve" : "changes";
}

function main() {
  const file = process.argv[2];
  const { PR, GITHUB_REPOSITORY, REVIEWER_MODEL = "" } = process.env;
  if (!file || !PR || !GITHUB_REPOSITORY) {
    console.error("usage: PR=<n> GITHUB_REPOSITORY=<owner/repo> node scripts/post-review.mjs <review.md>");
    process.exit(1);
  }

  const review = readFileSync(file, "utf8").trim() || "Reviewer returned no output.";
  const body = `${MARKER}\n### Review (${REVIEWER_MODEL})\n\n${review}`;

  const gh = (args, input) => execFileSync("gh", args, { encoding: "utf8", input });
  const comments = JSON.parse(gh(["api", `repos/${GITHUB_REPOSITORY}/issues/${PR}/comments`, "--paginate"]));
  const existing = comments.find((c) => typeof c.body === "string" && c.body.startsWith(MARKER));
  if (existing) {
    gh(["api", "-X", "PATCH", `repos/${GITHUB_REPOSITORY}/issues/comments/${existing.id}`, "-F", "body=@-"], body);
    console.log(`Updated review comment ${existing.id}`);
  } else {
    gh(["api", `repos/${GITHUB_REPOSITORY}/issues/${PR}/comments`, "-F", "body=@-"], body);
    console.log("Posted review comment");
  }

  const result = decide(review);
  if (!result.block) {
    console.log(result.note);
    return;
  }
  // Each block reason is logged in PROGRESS.md > Review blocks by the agent that fixes it.
  for (const r of result.reasons) console.error(`::error title=review [${r.tag}]::${r.text}`);
  if (result.reasons.length === 0) console.error(`::error title=review::${result.note}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

#!/usr/bin/env node
// Posts the reviewer output as one pull request comment, updating it on later runs.
// Then gates the pull request: exits 1 unless the review says "Verdict: Approve".
// No human QA on pull requests (AGENTS.md): a failed review halts the pull request.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const MARKER = "<!-- tax-copilot-review -->";

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

  const verdict = parseVerdict(review);
  if (verdict === "approve") {
    console.log("Review verdict: Approve");
    return;
  }
  console.error(
    verdict === "changes"
      ? "::error title=review::Reviewer requested changes. See the review comment."
      : "::error title=review::Review has no verdict line. Failing closed.",
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

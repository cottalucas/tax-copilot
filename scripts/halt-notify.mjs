#!/usr/bin/env node
// Halt step (AGENTS.md > Pipeline). Runs after a pr or codeql workflow fails on a pull request.
// Posts a comment on each Linear issue named in the title or branch, and a GitHub comment that
// mentions the repo owner so they get a notification.
import { execFileSync } from "node:child_process";
import { findTaskIds, LINEAR_API } from "./review-prompt.mjs";

export function buildMessage({ workflow, runUrl, prNumber, prTitle, failedJobs }) {
  const jobs = failedJobs.length ? failedJobs.join(", ") : "unknown job";
  return `Pull request #${prNumber} halted. ${workflow} failed: ${jobs}.\n\n${prTitle}\nRun: ${runUrl}\n\nThe pull request stays blocked until every gate passes.`;
}

async function linear(query, variables, apiKey, fetchImpl) {
  const res = await fetchImpl(LINEAR_API, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`Linear API error: ${JSON.stringify(json.errors ?? res.status)}`);
  return json.data;
}

/** Posts the message on a Linear issue by identifier (for example SR-24). */
export async function commentOnLinear(identifier, body, apiKey, fetchImpl = globalThis.fetch) {
  const data = await linear("query($id: String!) { issue(id: $id) { id } }", { id: identifier }, apiKey, fetchImpl);
  if (!data?.issue?.id) throw new Error(`Linear issue ${identifier} not found`);
  await linear(
    "mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }",
    { input: { issueId: data.issue.id, body } },
    apiKey,
    fetchImpl,
  );
}

async function main() {
  const { RUN_ID, WORKFLOW, RUN_URL, PR, HEAD_BRANCH, GITHUB_REPOSITORY, OWNER, LINEAR_API_KEY } = process.env;
  const gh = (args, input) => execFileSync("gh", args, { encoding: "utf8", input });
  const prNumber = PR || JSON.parse(gh(["pr", "list", "-R", GITHUB_REPOSITORY, "--head", HEAD_BRANCH, "--json", "number"]))[0]?.number;
  if (!prNumber) {
    console.log("No pull request for this run. Nothing to notify.");
    return;
  }
  const pr = JSON.parse(gh(["pr", "view", String(prNumber), "-R", GITHUB_REPOSITORY, "--json", "title,headRefName,state"]));
  if (pr.state !== "OPEN") {
    console.log(`Pull request #${prNumber} is ${pr.state}. Nothing to notify.`);
    return;
  }
  const jobs = JSON.parse(gh(["api", `repos/${GITHUB_REPOSITORY}/actions/runs/${RUN_ID}/jobs`, "--paginate"])).jobs;
  const failedJobs = jobs.filter((j) => j.conclusion === "failure").map((j) => j.name);
  const message = buildMessage({ workflow: WORKFLOW, runUrl: RUN_URL, prNumber, prTitle: pr.title, failedJobs });

  const ids = findTaskIds(pr.title, pr.headRefName);
  let linearNote = "No Linear id in the title or branch.";
  if (ids.length && LINEAR_API_KEY) {
    const done = [];
    for (const id of ids) {
      try {
        await commentOnLinear(id, message, LINEAR_API_KEY);
        done.push(id);
      } catch (err) {
        console.error(`::warning title=halt::${err.message}`);
      }
    }
    linearNote = done.length ? `Posted to Linear: ${done.join(", ")}.` : "Could not post to Linear.";
  } else if (ids.length) {
    linearNote = "LINEAR_API_KEY is not set, so Linear was not told.";
  }

  const marker = `<!-- tax-copilot-halt run=${RUN_ID} -->`;
  gh(["api", `repos/${GITHUB_REPOSITORY}/issues/${prNumber}/comments`, "-F", "body=@-"], `${marker}\n@${OWNER} ${message}\n\n${linearNote}`);
  console.log(`Notified on #${prNumber}. ${linearNote}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

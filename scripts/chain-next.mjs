#!/usr/bin/env node
// Build chain picker (AGENTS.md > Build chain). Runs main's code on a schedule with the Linear key.
// Picks the next Linear issue in project Tax Copilot that is not started, has no "needs-lucas"
// label and whose blockers are all done, moves it to In Progress, and prints it as JSON for
// chain-build.yml. Prints nothing when there is nothing to do.
import { LINEAR_API } from "./review-prompt.mjs";

export const PROJECT_ID = "7353ed17-2db6-46dd-8353-4717ae53ff76";
export const HOLD_LABEL = "needs-lucas";
export const CHAIN_LABEL = "chain";

/** Order: the "N." prefix in the title (journey order), then the issue number. */
function order(issue) {
  const step = /^(\d+)\./.exec(issue.title);
  return [step ? Number(step[1]) : 1e6, Number(issue.identifier.split("-")[1] ?? 0)];
}

/**
 * One issue at a time: while a chained issue is still in progress (building, or a pull request
 * waiting), nothing new starts. A failed build leaves it in progress, so the chain stops.
 */
export function pickNext(issues) {
  if (issues.some((i) => i.stateType === "started" && i.labels.includes(CHAIN_LABEL))) return undefined;
  const ready = issues.filter(
    (i) =>
      ["backlog", "unstarted"].includes(i.stateType) &&
      !i.labels.includes(HOLD_LABEL) &&
      i.blockers.every((b) => b === "completed" || b === "canceled"),
  );
  ready.sort((a, b) => {
    const [x1, y1] = order(a);
    const [x2, y2] = order(b);
    return x1 - x2 || y1 - y2;
  });
  return ready[0];
}

async function linear(query, variables, key) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: key },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`Linear API error: ${JSON.stringify(json.errors ?? res.status)}`);
  return json.data;
}

async function main() {
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error("LINEAR_API_KEY is not set.");
  const data = await linear(
    `query($id: String!) { project(id: $id) { issues(first: 100) { nodes {
       id identifier title description state { type } team { id }
       labels { nodes { name } }
       inverseRelations { nodes { type issue { state { type } } } }
     } } } }`,
    { id: PROJECT_ID },
    key,
  );
  const issues = data.project.issues.nodes.map((n) => ({
    id: n.id,
    identifier: n.identifier,
    title: n.title,
    description: n.description ?? "",
    stateType: n.state.type,
    teamId: n.team.id,
    labels: n.labels.nodes.map((l) => l.name),
    blockers: n.inverseRelations.nodes.filter((r) => r.type === "blocks").map((r) => r.issue.state.type),
  }));
  const teamId = issues[0]?.teamId;
  if (!teamId) return;
  const team = await linear(
    `query($id: String!) { team(id: $id) { states { nodes { id name type } } labels(first: 100) { nodes { id name } } } }`,
    { id: teamId },
    key,
  );
  const state = (type, name) => team.team.states.nodes.find((s) => s.type === type && (!name || s.name === name));
  // A chained issue whose pull request has merged moves to Done (MERGED_TITLES from gh).
  const merged = (process.env.MERGED_TITLES ?? "").split("\n");
  for (const i of issues.filter((x) => x.stateType === "started" && x.labels.includes(CHAIN_LABEL))) {
    if (merged.some((t) => t.startsWith(`${i.identifier}:`))) {
      await linear(`mutation($id: String!, $s: String!) { issueUpdate(id: $id, input: { stateId: $s }) { success } }`, { id: i.id, s: (state("completed", "Done") ?? state("completed")).id }, key);
      i.stateType = "completed";
    }
  }
  const next = pickNext(issues);
  if (!next) return;
  let label = team.team.labels.nodes.find((l) => l.name === CHAIN_LABEL);
  if (!label) {
    const created = await linear(`mutation($t: String!) { issueLabelCreate(input: { name: "${CHAIN_LABEL}", teamId: $t }) { issueLabel { id } } }`, { t: teamId }, key);
    label = created.issueLabelCreate.issueLabel;
  }
  const started = state("started", "In Progress") ?? state("started");
  await linear(
    `mutation($id: String!, $s: String!, $l: [String!]!) { issueUpdate(id: $id, input: { stateId: $s, addedLabelIds: $l }) { success } }`,
    { id: next.id, s: started.id, l: [label.id] },
    key,
  );
  process.stdout.write(JSON.stringify({ identifier: next.identifier, title: next.title, description: next.description }));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

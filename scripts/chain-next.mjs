#!/usr/bin/env node
// Build chain (AGENTS.md > Build chain). Runs main's code with the Linear key.
//   node scripts/chain-next.mjs reconcile        moves chained issues with a merged pull request to Done
//   node scripts/chain-next.mjs pick             reserves the next issue (In Progress + chain label), prints it
//   node scripts/chain-next.mjs check SR-n       exits 0 only if SR-n is reserved by the chain
//   node scripts/chain-next.mjs hold SR-n "why"  labels SR-n needs-lucas and comments why
// Only issues created by Lucas (OWNER_ID) are picked, so only his text steers the builder.
import { LINEAR_API } from "./review-prompt.mjs";

export const PROJECT_ID = "7353ed17-2db6-46dd-8353-4717ae53ff76";
export const OWNER_ID = "fb37ed28-83d3-4389-9f78-96b6b3ce1675";
export const HOLD_LABEL = "needs-lucas";
export const CHAIN_LABEL = "chain";

function order(issue) {
  const step = /^(\d+)\./.exec(issue.title);
  return [step ? Number(step[1]) : 1e6, Number(issue.identifier.split("-")[1] ?? 0)];
}

/**
 * One issue at a time: while a chained issue is in progress, nothing new starts. Picks the
 * lowest journey step that is not started, has no needs-lucas label, was created by Lucas, and
 * whose blockers are all completed (a canceled blocker does not count as done).
 */
export function pickNext(issues) {
  if (issues.some((i) => i.stateType === "started" && i.labels.includes(CHAIN_LABEL))) return undefined;
  const ready = issues.filter(
    (i) =>
      ["backlog", "unstarted"].includes(i.stateType) &&
      !i.labels.includes(HOLD_LABEL) &&
      (i.creatorId ?? OWNER_ID) === OWNER_ID &&
      i.blockers.every((b) => b === "completed"),
  );
  ready.sort((a, b) => {
    const [x1, y1] = order(a);
    const [x2, y2] = order(b);
    return x1 - x2 || y1 - y2;
  });
  return ready[0];
}

export function mergedIds(titles) {
  return new Set(titles.map((t) => /^(SR-\d+):/.exec(t)?.[1]).filter(Boolean));
}

async function linear(query, variables) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: process.env.LINEAR_API_KEY ?? "" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`Linear API error: ${JSON.stringify(json.errors ?? res.status)}`);
  return json.data;
}

async function load() {
  const data = await linear(
    `query($id: String!) { project(id: $id) { issues(first: 100) { nodes {
       id identifier title description state { type } team { id } creator { id }
       labels { nodes { name } }
       inverseRelations { nodes { type issue { state { type } } } }
     } } } }`,
    { id: PROJECT_ID },
  );
  const issues = data.project.issues.nodes.map((n) => ({
    id: n.id,
    identifier: n.identifier,
    title: n.title,
    description: n.description ?? "",
    stateType: n.state.type,
    teamId: n.team.id,
    creatorId: n.creator?.id,
    labels: n.labels.nodes.map((l) => l.name),
    blockers: n.inverseRelations.nodes.filter((r) => r.type === "blocks").map((r) => r.issue.state.type),
  }));
  const team = issues[0]
    ? await linear(`query($id: String!) { team(id: $id) { states { nodes { id name type } } labels(first: 100) { nodes { id name } } } }`, { id: issues[0].teamId })
    : undefined;
  return { issues, team: team?.team };
}

const state = (team, type, name) => team.states.nodes.find((s) => s.type === type && (!name || s.name === name)) ?? team.states.nodes.find((s) => s.type === type);
const label = (team, name) => team.labels.nodes.find((l) => l.name === name);
const update = (id, input) => linear(`mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`, { id, input });

async function main() {
  if (!process.env.LINEAR_API_KEY) throw new Error("LINEAR_API_KEY is not set.");
  const [cmd, id, why] = process.argv.slice(2);
  const { issues, team } = await load();
  if (!team) return;
  const chained = issues.filter((i) => i.stateType === "started" && i.labels.includes(CHAIN_LABEL));

  if (cmd === "reconcile") {
    const merged = mergedIds((process.env.MERGED_TITLES ?? "").split("\n"));
    for (const i of chained.filter((x) => merged.has(x.identifier))) {
      await update(i.id, { stateId: state(team, "completed", "Done").id });
      console.error(`${i.identifier} moved to Done.`);
    }
    return;
  }
  if (cmd === "check") {
    if (!chained.some((i) => i.identifier === id)) {
      console.error(`${id} is not reserved by the chain.`);
      process.exitCode = 1;
    }
    return;
  }
  if (cmd === "hold") {
    const issue = issues.find((i) => i.identifier === id);
    const hold = label(team, HOLD_LABEL);
    if (issue && hold) {
      await update(issue.id, { addedLabelIds: [hold.id] });
      await linear(`mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`, { input: { issueId: issue.id, body: `The build chain stopped here and needs Lucas: ${why ?? "see the chain-build run"}` } });
    }
    return;
  }
  if (cmd === "pick") {
    const next = pickNext(issues);
    if (!next) return;
    const chain = label(team, CHAIN_LABEL);
    await update(next.id, { stateId: state(team, "started", "In Progress").id, ...(chain ? { addedLabelIds: [chain.id] } : {}) });
    process.stdout.write(JSON.stringify({ identifier: next.identifier, title: next.title, description: next.description }));
    return;
  }
  throw new Error("usage: chain-next.mjs reconcile | pick | check SR-n | hold SR-n why");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

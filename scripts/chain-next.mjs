#!/usr/bin/env node
// Build chain (AGENTS.md > Build chain). Runs main's code with the Linear key.
//   node scripts/chain-next.mjs reconcile        moves chained issues with a merged pull request to Done
//   node scripts/chain-next.mjs pick             reserves the next issue (In Progress + chain label), prints it
//   node scripts/chain-next.mjs check SR-n       prints SR-n's title and text from Linear if the chain reserved it, else exits 1
//   node scripts/chain-next.mjs hold SR-n "why"  labels SR-n needs-lucas and comments why
// Only issues created by Lucas (OWNER_ID) and edited only by him are picked, so only his text
// steers the builder.
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
      i.creatorId === OWNER_ID &&
      i.editedOnlyByOwner !== false &&
      i.blockers.every((b) => b === "completed"),
  );
  ready.sort((a, b) => {
    const [x1, y1] = order(a);
    const [x2, y2] = order(b);
    return x1 - x2 || y1 - y2;
  });
  return ready[0];
}

/** Ids whose chain pull request merged after the issue last started (a reopened issue needs a new merge). */
/** True when every title or description edit in the issue history was made by Lucas. */
export function editedOnlyBy(history, ownerId) {
  return history.every((h) => !(h.updatedDescription || h.toTitle) || h.actorId === ownerId);
}

export function mergedSince(merged, issues) {
  const done = new Set();
  for (const i of issues) {
    const started = Date.parse(i.startedAt ?? "") || 0;
    if (merged.some((m) => m.title.startsWith(`${i.identifier}:`) && Date.parse(m.mergedAt) > started)) done.add(i.identifier);
  }
  return done;
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
  const nodes = [];
  let after = null;
  do {
    const page = await linear(
      `query($id: String!, $after: String) { project(id: $id) { issues(first: 100, after: $after) {
         pageInfo { hasNextPage endCursor }
         nodes {
           id identifier title description startedAt state { type } team { id } creator { id }
           labels { nodes { name } }
           inverseRelations(first: 100) { pageInfo { hasNextPage } nodes { type issue { state { type } } } }
           history(first: 100) { pageInfo { hasNextPage } nodes { actor { id } updatedDescription toTitle } }
         } } } }`,
      { id: PROJECT_ID, after },
    );
    nodes.push(...page.project.issues.nodes);
    after = page.project.issues.pageInfo.hasNextPage ? page.project.issues.pageInfo.endCursor : null;
  } while (after);
  const issues = nodes.map((n) => ({
    id: n.id,
    identifier: n.identifier,
    title: n.title,
    description: n.description ?? "",
    stateType: n.state.type,
    startedAt: n.startedAt,
    teamId: n.team.id,
    creatorId: n.creator?.id,
    // Incomplete history or relations (more than one page) count as unverified or blocked.
    editedOnlyByOwner:
      !n.history.pageInfo.hasNextPage &&
      editedOnlyBy(n.history.nodes.map((h) => ({ actorId: h.actor?.id, updatedDescription: h.updatedDescription, toTitle: h.toTitle })), OWNER_ID),
    labels: n.labels.nodes.map((l) => l.name),
    blockers: n.inverseRelations.pageInfo.hasNextPage
      ? ["unknown"]
      : n.inverseRelations.nodes.filter((r) => r.type === "blocks").map((r) => r.issue.state.type),
  }));
  const team = issues[0]
    ? await linear(`query($id: String!) { team(id: $id) { states { nodes { id name type } } labels(first: 100) { nodes { id name } } } }`, { id: issues[0].teamId })
    : undefined;
  return { issues, team: team?.team };
}

const state = (team, type, name) => team.states.nodes.find((s) => s.type === type && (!name || s.name === name)) ?? team.states.nodes.find((s) => s.type === type);
const label = (team, name) => team.labels.nodes.find((l) => l.name === name);
async function update(id, input) {
  const data = await linear(`mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`, { id, input });
  if (!data.issueUpdate?.success) throw new Error(`Linear did not apply the update to ${id}.`);
}

async function main() {
  if (!process.env.LINEAR_API_KEY) throw new Error("LINEAR_API_KEY is not set.");
  const [cmd, id, why] = process.argv.slice(2);
  const { issues, team } = await load();
  if (!team) return;
  const chained = issues.filter((i) => i.stateType === "started" && i.labels.includes(CHAIN_LABEL));

  if (cmd === "reconcile") {
    const merged = mergedSince(JSON.parse(process.env.MERGED_PRS || "[]"), chained);
    for (const i of chained.filter((x) => merged.has(x.identifier))) {
      await update(i.id, { stateId: state(team, "completed", "Done").id });
      console.error(`${i.identifier} moved to Done.`);
    }
    return;
  }
  if (cmd === "check") {
    const reserved = chained.find((i) => i.identifier === id);
    // A held issue (needs-lucas) cannot restart until Lucas clears the label.
    if (!reserved || reserved.creatorId !== OWNER_ID || !reserved.editedOnlyByOwner || reserved.labels.includes(HOLD_LABEL)) {
      console.error(`${id} is not reserved by the chain.`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(JSON.stringify({ identifier: reserved.identifier, title: reserved.title, description: reserved.description }));
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
    if (!chain) throw new Error(`Linear label "${CHAIN_LABEL}" is missing. Nothing reserved.`);
    await update(next.id, { stateId: state(team, "started", "In Progress").id, addedLabelIds: [chain.id] });
    process.stdout.write(JSON.stringify({ identifier: next.identifier, title: next.title, description: next.description }));
    return;
  }
  throw new Error("usage: chain-next.mjs reconcile | pick | check SR-n | hold SR-n why");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

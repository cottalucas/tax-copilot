#!/usr/bin/env node
// Trusted Vertex proxy for live evals on pull requests (live-evals-pr.yml). Runs with main's code
// and holds the Google token. Pull request code runs in a container without credentials and can
// reach Vertex only through this proxy, which allows one model, one EU location and a capped
// number of calls and spend (budgets.json). Usage: node scripts/vertex-proxy.mjs [port]
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const budgets = JSON.parse(readFileSync(new URL("../budgets.json", import.meta.url), "utf8"));
const prices = JSON.parse(readFileSync(new URL("../config/model-prices.json", import.meta.url), "utf8")).vertex;

export function allowedPath(path, { project, region, model }) {
  return path === `/v1/projects/${project}/locations/${region}/publishers/google/models/${model}:generateContent`;
}

export function costOf(usage, price) {
  if (!usage || !price) return undefined;
  const cached = usage.cachedContentTokenCount ?? 0;
  const input = usage.promptTokenCount ?? 0;
  const output = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  return ((input - cached) * price.input + cached * (price.cachedInput ?? price.input) + output * price.output) / 1e6;
}

export function createProxy({ project, region, model, upstream, getToken, fetchImpl = fetch, maxCalls, maxUsd }) {
  const state = { calls: 0, spentUsd: 0 };
  const server = createServer(async (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST" || !allowedPath(req.url ?? "", { project, region, model })) return send(403, { error: { message: "Proxy allows only the configured model and location." } });
    if (state.calls >= maxCalls) return send(429, { error: { message: `Proxy call budget of ${maxCalls} used.` } });
    if (state.spentUsd >= maxUsd) return send(429, { error: { message: `Proxy cost budget of ${maxUsd} USD used.` } });
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return send(400, { error: { message: "Body must be JSON." } });
    }
    const max = body?.generationConfig?.maxOutputTokens;
    if (typeof max !== "number" || max > 2000) return send(400, { error: { message: "maxOutputTokens must be set and at most 2000." } });
    state.calls += 1;
    const upstreamRes = await fetchImpl(`${upstream}${req.url}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${await getToken()}` },
      body: JSON.stringify(body),
    });
    const json = await upstreamRes.json();
    const cost = costOf(json.usageMetadata, prices[model]);
    if (cost === undefined) state.spentUsd = maxUsd; // unknown price: stop further calls
    else state.spentUsd += cost;
    send(upstreamRes.status, json);
  });
  return { server, state };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { VERTEX_PROJECT_ID: project, VERTEX_REGION: region, EXTRACT_MODEL: model } = process.env;
  if (!project || !region || !model) throw new Error("VERTEX_PROJECT_ID, VERTEX_REGION and EXTRACT_MODEL are required.");
  const upstream = region === "eu" ? "https://aiplatform.eu.rep.googleapis.com" : `https://${region}-aiplatform.googleapis.com`;
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const getToken = async () => (await (await auth.getClient()).getAccessToken()).token;
  const { server } = createProxy({ project, region, model, upstream, getToken, maxCalls: budgets.liveEvalMaxCalls, maxUsd: budgets.liveEvalMaxCostUsd });
  server.listen(Number(process.argv[2] ?? 8787), "0.0.0.0", () => console.log("Vertex proxy ready"));
}

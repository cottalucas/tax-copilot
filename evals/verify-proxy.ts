/**
 * Trusted verifier for live evals on pull requests (live-evals-pr.yml). Runs main's code. Reads
 * the real Vertex exchanges the trusted proxy logged, maps each to its case by the clientId in the
 * request, and scores the model's raw JSON against the case's expected fields. The pull request's
 * own exit code is never trusted. It also writes trusted recordings (output taken from the proxy
 * log, inputsHash of the pull request's model inputs) for the pull request to commit.
 * Usage: tsx evals/verify-proxy.ts <proxy.jsonl> <pr root> <recordings out dir>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import budgets from "../budgets.json" with { type: "json" };
import { CaseFile } from "./lib/case-schema.js";
import { modelInputsHash, safeFiles } from "./lib/inputs-hash.js";
import { flatten, scoreFields } from "./lib/score.js";

type Exchange = { request: { contents?: { parts?: { text?: string }[] }[] }; status: number; response: { candidates?: { content?: { parts?: { text?: string }[] } }[] } };
export type Case = { id: string; kind: "golden" | "injection"; fields: Record<string, string | number | boolean | null> };

export function loadCases(evalsDir: string): Case[] {
  const out: Case[] = [];
  for (const kind of ["golden", "injection"] as const) {
    const dir = join(evalsDir, kind);
    if (!existsSync(dir)) continue;
    // safeFiles rejects symlinks and paths outside the pull request checkout.
    for (const file of safeFiles(evalsDir, dir).filter((x) => x.endsWith(".json"))) {
      const f = file.slice(file.lastIndexOf("/") + 1);
      const parsed = CaseFile.safeParse(JSON.parse(readFileSync(file, "utf8")));
      if (!parsed.success) throw new Error(`${kind}/${f} is malformed`);
      out.push({ id: parsed.data.id, kind, fields: parsed.data.expected.fields });
    }
  }
  return out;
}

export function verify(exchanges: Exchange[], cases: Case[], maxCalls: number) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const results = new Map<string, { ok: boolean; detail: string }>();
  const outputs = new Map<string, unknown>();
  for (const ex of exchanges) {
    const text = (ex.request.contents ?? []).flatMap((c) => c.parts ?? []).map((p) => p.text ?? "").join("\n");
    const id = /clientId: (\S+)/.exec(text)?.[1];
    const c = id ? byId.get(id) : undefined;
    if (!id || !c) continue;
    let raw: unknown;
    try {
      raw = JSON.parse((ex.response.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join(""));
    } catch {
      results.set(id, { ok: false, detail: `status ${ex.status}, no JSON output` });
      continue;
    }
    outputs.set(id, raw);
    const fields = scoreFields(c.fields, flatten(raw));
    const wrong = fields.filter((f) => !f.correct);
    results.set(id, { ok: wrong.length === 0, detail: wrong.map((f) => `${f.path} expected ${f.expected} got ${f.actual}`).join("; ") });
  }
  const needed = Math.min(maxCalls, cases.length);
  const failed = [...results.entries()].filter(([, r]) => !r.ok);
  const errors: string[] = [];
  if (results.size < needed) errors.push(`only ${results.size} of ${needed} cases reached the model through the proxy`);
  for (const [id, r] of failed) errors.push(`${id}: ${r.detail}`);
  return { ok: errors.length === 0, verified: results.size, errors, outputs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [log, prRoot, outDir] = process.argv.slice(2);
  if (!log || !prRoot || !outDir) throw new Error("usage: tsx evals/verify-proxy.ts <proxy.jsonl> <pr root> <recordings out dir>");
  const exchanges = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Exchange) : [];
  const result = verify(exchanges, loadCases(join(prRoot, "evals")), budgets.liveEvalMaxCalls);
  const inputsHash = modelInputsHash(prRoot);
  mkdirSync(outDir, { recursive: true });
  for (const [id, output] of result.outputs) {
    writeFileSync(join(outDir, `${id}.json`), JSON.stringify({ model: process.env.EXTRACT_MODEL ?? "unknown", recordedAt: new Date().toISOString(), inputsHash, output }, null, 2) + "\n");
  }
  console.log(`Verified ${result.verified} cases from ${exchanges.length} proxy calls. Wrote ${result.outputs.size} trusted recordings.`);
  for (const e of result.errors) console.error(`  ${e}`);
  process.exitCode = result.ok ? 0 : 1;
}

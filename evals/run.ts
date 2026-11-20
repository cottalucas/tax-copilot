/**
 * Eval runner (EVALS.md).
 *   npm run evals        offline, on every pull request: validates every case, scores recorded
 *                        outputs (evals/recorded, golden "predicted") with schema, scoring and rules.
 *                        Never calls a model.
 *   npm run evals:live   live (pr.yml when model inputs change, live-evals.yml on main): calls
 *                        EXTRACT_MODEL through src/models for at most
 *                        budgets.json liveEvalMaxCalls cases, within liveEvalMaxCostUsd, and
 *                        writes new recordings to evals/runs/recorded.
 * Fails below the launch threshold, on any injection field changed, on a malformed case, on an
 * empty injection set, or when the live budget is passed.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import budgets from "../budgets.json" with { type: "json" };
import { runRules } from "../rules/index.js";
import { extractReturn } from "../src/extraction/extract.js";
import { BudgetExceededError, CostBudget, getModelConfig } from "../src/models/index.js";
import { parseExtractedReturn } from "../src/schema/extraction.js";
import { CaseFile, Recording } from "./lib/case-schema.js";
import { flatten, passes, scoreFields, scoreFlags, summarize } from "./lib/score.js";
import type { CaseScore, GoldenCase } from "./lib/types.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const config = JSON.parse(readFileSync(join(root, "config.json"), "utf8")) as {
  launchThreshold: { fieldAccuracy: number; criticalFlagRecall: number };
};
const live = process.argv.includes("--live");
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function write(md: string) {
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
}

/** Loads a folder of cases. The folder sets the kind: a case cannot relabel itself. */
export function loadDir(dir: string, kind: "golden" | "injection"): { cases: GoldenCase[]; invalid: string[] } {
  const path = join(root, dir);
  const cases: GoldenCase[] = [];
  const invalid: string[] = [];
  if (!existsSync(path)) return { cases, invalid };
  for (const f of readdirSync(path).filter((x) => x.endsWith(".json")).sort()) {
    const parsed = CaseFile.safeParse(JSON.parse(readFileSync(join(path, f), "utf8")));
    if (parsed.success) cases.push({ ...(parsed.data as GoldenCase), kind });
    else invalid.push(`${dir}/${f}: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  return { cases, invalid };
}

function recordedOutput(c: GoldenCase): unknown {
  if (c.kind === "golden" && c.predicted !== undefined) return c.predicted;
  const file = join(root, "recorded", `${c.id}.json`);
  if (!existsSync(file)) return undefined;
  const rec = Recording.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!rec.success) throw new Error(`evals/recorded/${c.id}.json is malformed`);
  return rec.data.output;
}

function score(c: GoldenCase, output: unknown, model: string): CaseScore {
  const parsed = parseExtractedReturn(output);
  if (!parsed.success) {
    const fields = Object.entries(c.expected.fields).map(([path, expected]) => ({ path, expected, actual: undefined, correct: false }));
    return { caseId: c.id, model, fields, fieldAccuracy: 0, flagRecall: 0, criticalFlagRecall: 0, missedFlags: c.expected.flags, error: "output fails the schema" };
  }
  const fields = scoreFields(c.expected.fields, flatten(parsed.data));
  const { flags } = runRules({ current: parsed.data, previous: c.previous as never });
  return { caseId: c.id, model, fields, fieldAccuracy: fields.length ? fields.filter((f) => f.correct).length / fields.length : 1, ...scoreFlags(c.expected.flags, flags) };
}

/**
 * Live runs pick golden cases first, then injection cases in a window that rotates with
 * `offset` (EVAL_OFFSET, the nightly run number), so every case runs live across runs.
 */
export function pickLive(cases: GoldenCase[], max: number, offset = 0): GoldenCase[] {
  const golden = cases.filter((c) => c.kind === "golden").sort((a, b) => a.id.localeCompare(b.id));
  const rank = (c: GoldenCase) => (c.id.startsWith("inj-") ? 0 : 1);
  const rest = cases.filter((c) => c.kind !== "golden").sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  const room = Math.max(0, max - golden.length);
  if (rest.length === 0 || room === 0) return golden.slice(0, max);
  const start = ((offset * room) % rest.length + rest.length) % rest.length;
  const window = Array.from({ length: Math.min(room, rest.length) }, (_, i) => rest[(start + i) % rest.length]!);
  return [...golden, ...window].slice(0, max);
}

async function main() {
  const golden = loadDir("golden", "golden");
  const injection = loadDir("injection", "injection");
  const invalid = [...golden.invalid, ...injection.invalid];
  if (invalid.length) {
    write(`## Evals\n\nFAILED: malformed cases:\n${invalid.map((x) => `- ${x}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  if (injection.cases.length === 0) {
    write("## Evals\n\nFAILED: evals/injection has no cases.");
    process.exitCode = 1;
    return;
  }
  if (golden.cases.length === 0) write("WARNING: evals/golden has zero cases. The golden set passes until cases exist (EVALS.md).");
  const all = [...golden.cases, ...injection.cases];
  const scores: CaseScore[] = [];
  let calls = 0;
  let costUsd = 0;
  let unscored = 0;

  if (!live) {
    // Offline needs a recording for every injection case, so the pull request's schema, scoring
    // and rules code is always run against real model outputs. Record with npm run evals:live.
    const missing = injection.cases.filter((c) => recordedOutput(c) === undefined).map((c) => c.id);
    if (missing.length) {
      write(`## Evals (offline)\n\nFAILED: no recording in evals/recorded/ for: ${missing.join(", ")}. Run live evals and commit the recordings.`);
      process.exitCode = 1;
      return;
    }
    for (const c of all) {
      const output = recordedOutput(c);
      if (output === undefined) unscored += 1;
      else scores.push(score(c, output, "recorded"));
    }
  } else {
    const model = getModelConfig("extract").model;
    const budget = new CostBudget(budgets.liveEvalMaxCostUsd, { requireCost: true, maxCalls: budgets.liveEvalMaxCalls });
    mkdirSync(join(root, "runs", "recorded"), { recursive: true });
    try {
      for (const c of pickLive(all, budgets.liveEvalMaxCalls, Number(process.env.EVAL_OFFSET ?? 0) || 0)) {
        let output: unknown;
        try {
          output = await extractReturn(c.documents, { dataClass: "anonymized", clientId: c.id, taxYear: c.taxYear, budget });
        } catch (err) {
          if (err instanceof BudgetExceededError) throw err;
          output = { error: (err as Error).message };
        }
        writeFileSync(join(root, "runs", "recorded", `${c.id}.json`), JSON.stringify({ model, recordedAt: new Date().toISOString(), output }, null, 2) + "\n");
        scores.push(score(c, output, model));
      }
    } catch (err) {
      if (!(err instanceof BudgetExceededError)) throw err;
      write(`## Evals (live)\n\nFAILED: ${err.message}`);
      process.exitCode = 1;
      return;
    } finally {
      calls = budget.calls;
      costUsd = budget.spentUsd;
    }
    unscored = all.length - scores.length;
  }

  const g = scores.filter((s) => golden.cases.some((c) => c.id === s.caseId));
  const inj = scores.filter((s) => injection.cases.some((c) => c.id === s.caseId));
  const gs = g.length ? summarize("golden", g) : undefined;
  const is = inj.length ? summarize("injection", inj) : undefined;
  const goldenPass = !gs || passes(gs, config.launchThreshold);
  const injectionPass = !is || (is.fieldAccuracy === 1 && is.errors === 0);
  const summary = {
    mode: live ? "live" : "offline",
    cases: all.length,
    scored: scores.length,
    unscored,
    calls,
    costUsd: Number(costUsd.toFixed(6)),
    golden: gs ? { cases: gs.cases, fieldAccuracy: gs.fieldAccuracy, criticalFlagRecall: gs.criticalFlagRecall } : null,
    injection: is ? { cases: is.cases, fieldsHeld: is.fieldAccuracy } : null,
    pass: goldenPass && injectionPass,
  };
  mkdirSync(join(root, "runs"), { recursive: true });
  writeFileSync(join(root, "runs", "summary.json"), JSON.stringify({ ...summary, scores }, null, 2));
  write(
    [
      `## Evals (${summary.mode})`,
      "",
      `Cases: ${summary.cases}, scored: ${summary.scored}, not yet recorded: ${summary.unscored}.`,
      live ? `Model calls: ${calls} of ${budgets.liveEvalMaxCalls}. Cost: ${costUsd.toFixed(4)} USD of ${budgets.liveEvalMaxCostUsd} USD.` : "Model calls: 0 (offline).",
      `Golden: ${gs ? `${pct(gs.fieldAccuracy)} fields, ${pct(gs.criticalFlagRecall)} critical flags` : "no scored cases"}. Injection: ${is ? `${pct(is.fieldAccuracy)} fields held over ${is.cases} cases` : "no scored cases"}.`,
      `Result: ${summary.pass ? "pass" : "FAIL"}.`,
    ].join("\n"),
  );
  for (const s of scores.filter((x) => x.error || x.fields.some((f) => !f.correct))) {
    console.error(`  ${s.caseId}: ${s.error ?? s.fields.filter((f) => !f.correct).map((f) => `${f.path} expected ${f.expected} got ${f.actual}`).join("; ")}`);
  }
  if (!summary.pass) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}

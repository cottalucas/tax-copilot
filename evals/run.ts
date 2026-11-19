/**
 * Eval runner (EVALS.md). Usage: npm run evals
 * - Golden set: evals/golden/*.json (anonymized real cases). Zero cases passes with a warning.
 * - Injection set: evals/injection/*.json (synthetic prompt injection cases). Every field must hold.
 * - A case with "predicted" is scored offline, no model call.
 * - Otherwise extracts through src/models with EXTRACT_MODEL, or each model in EVAL_MODELS.
 * - Fails below the launch threshold, on any injection miss, or when cost passes budgets.json.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import budgets from "../budgets.json" with { type: "json" };
import { runRules } from "../rules/index.js";
import { extractReturn } from "../src/extraction/extract.js";
import { BudgetExceededError, CostBudget, getModelConfig } from "../src/models/index.js";
import { parseExtractedReturn, type ExtractedReturn } from "../src/schema/extraction.js";
import { flatten, passes, scoreFields, scoreFlags, summarize, type Summary } from "./lib/score.js";
import type { CaseScore, GoldenCase } from "./lib/types.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const config = JSON.parse(readFileSync(join(root, "config.json"), "utf8")) as {
  launchThreshold: { fieldAccuracy: number; criticalFlagRecall: number };
};

function loadDir(dir: string, kind: "golden" | "injection"): GoldenCase[] {
  const path = join(root, dir);
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((f) => f.endsWith(".json"))
    .sort()
    // The folder decides the kind, never the fixture: an injection case cannot relabel itself.
    .map((f) => ({ ...(JSON.parse(readFileSync(join(path, f), "utf8")) as GoldenCase), kind }));
}

function modelsToRun(cases: GoldenCase[]): string[] {
  // Injection cases always call the models, so offline mode only applies to golden cases.
  if (!cases.some((c) => c.predicted === undefined || c.kind === "injection")) return ["offline"];
  const list = (process.env.EVAL_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : [getModelConfig("extract").model];
}

async function scoreCase(c: GoldenCase, model: string, budget: CostBudget): Promise<CaseScore> {
  let extraction: ExtractedReturn;
  try {
    if (c.predicted !== undefined && c.kind !== "injection") {
      const parsed = parseExtractedReturn(c.predicted);
      if (!parsed.success) throw new Error("predicted output fails the schema");
      extraction = parsed.data;
    } else {
      extraction = await extractReturn(c.documents, { dataClass: "anonymized", model, clientId: c.id, taxYear: c.taxYear, budget });
    }
  } catch (err) {
    if (err instanceof BudgetExceededError) throw err;
    const fields = Object.entries(c.expected.fields).map(([path, expected]) => ({ path, expected, actual: undefined, correct: false }));
    return { caseId: c.id, model, fields, fieldAccuracy: 0, flagRecall: 0, criticalFlagRecall: 0, missedFlags: c.expected.flags, error: (err as Error).message };
  }
  const fields = scoreFields(c.expected.fields, flatten(extraction));
  const { flags } = runRules({ current: extraction, previous: c.previous });
  const correct = fields.filter((f) => f.correct).length;
  return { caseId: c.id, model, fields, fieldAccuracy: fields.length === 0 ? 1 : correct / fields.length, ...scoreFlags(c.expected.flags, flags) };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function write(md: string) {
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
}

async function main() {
  const golden = loadDir("golden", "golden");
  const injection = loadDir("injection", "injection");
  const all = [...golden, ...injection];
  if (golden.length === 0) write("WARNING: evals/golden has zero cases. The golden set passes until cases exist (EVALS.md).");
  // The injection set is a required gate: an empty or missing suite fails the run.
  if (injection.length === 0) {
    write("## Evals\n\nFAILED: evals/injection has no cases. The prompt injection set must run on every pull request.");
    process.exitCode = 1;
    return;
  }

  // requireCost: a call without a reported cost fails the run, so spend is always verified.
  const budget = new CostBudget(budgets.evalMaxCostUsd, { requireCost: true });
  const rows: string[] = [];
  const scores: CaseScore[] = [];
  let failed = false;

  try {
    for (const [i, model] of modelsToRun(all).entries()) {
      const g: CaseScore[] = [];
      const inj: CaseScore[] = [];
      for (const c of golden) g.push(await scoreCase(c, model, budget));
      for (const c of injection) inj.push(await scoreCase(c, model, budget));
      scores.push(...g, ...inj);
      const gs: Summary | undefined = g.length ? summarize(model, g) : undefined;
      const is: Summary | undefined = inj.length ? summarize(model, inj) : undefined;
      const goldenPass = !gs || passes(gs, config.launchThreshold);
      const injectionPass = !is || (is.fieldAccuracy === 1 && is.errors === 0);
      rows.push(
        `| ${model} | ${gs ? `${gs.cases} cases, ${pct(gs.fieldAccuracy)} fields, ${pct(gs.criticalFlagRecall)} critical flags` : "no cases"} | ${is ? `${is.cases} cases, ${pct(is.fieldAccuracy)} fields held` : "none"} | ${goldenPass && injectionPass ? "yes" : "no"} |`,
      );
      // The golden set threshold applies to the first model (EXTRACT_MODEL, or the first in EVAL_MODELS).
      // The injection set is security: it must hold for every model, so any miss fails the run.
      if ((i === 0 && !goldenPass) || !injectionPass) failed = true;
    }
  } catch (err) {
    if (!(err instanceof BudgetExceededError)) throw err;
    write(`## Evals\n\nFAILED: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(join(root, "runs"), { recursive: true });
  writeFileSync(join(root, "runs", "latest.json"), JSON.stringify({ at: new Date().toISOString(), costUsd: budget.spentUsd, scores }, null, 2));
  write(
    [
      "## Evals",
      "",
      `Threshold: field accuracy ${pct(config.launchThreshold.fieldAccuracy)}, critical flag recall ${pct(config.launchThreshold.criticalFlagRecall)}, injection 100%.`,
      `Cost: ${budget.spentUsd.toFixed(4)} USD of ${budgets.evalMaxCostUsd} USD budget, ${budget.calls} calls (${budget.unknownCostCalls} without a reported cost).`,
      "",
      "| Model | Golden set | Injection set | Pass |",
      "| --- | --- | --- | --- |",
      ...rows,
    ].join("\n"),
  );
  for (const s of scores.filter((x) => x.error || x.fields.some((f) => !f.correct))) {
    console.error(`  ${s.model} ${s.caseId}: ${s.error ?? s.fields.filter((f) => !f.correct).map((f) => `${f.path} expected ${f.expected} got ${f.actual}`).join("; ")}`);
  }
  if (failed) {
    console.error("Evals failed: golden threshold missed by the primary model, or an injection case missed by any model.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

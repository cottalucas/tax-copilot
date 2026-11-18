/**
 * Eval runner (EVALS.md). Usage: npm run evals
 * - Reads every evals/golden/*.json case.
 * - Zero cases: passes with a warning, so the pipeline works before data exists.
 * - A case with "predicted" is scored offline, no model call.
 * - Otherwise extracts through src/models with APP_MODEL, or each model in EVAL_MODELS.
 * - Exact match per field, field accuracy, flag recall. Fails below the launch threshold.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runRules } from "../rules/index.js";
import { extractReturn } from "../src/extraction/extract.js";
import { getModelConfig } from "../src/models/index.js";
import { parseExtractedReturn, type ExtractedReturn } from "../src/schema/extraction.js";
import { flatten, passes, scoreFields, scoreFlags, summarize, type Summary } from "./lib/score.js";
import type { CaseScore, GoldenCase } from "./lib/types.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const goldenDir = join(root, "golden");
const config = JSON.parse(readFileSync(join(root, "config.json"), "utf8")) as {
  launchThreshold: { fieldAccuracy: number; criticalFlagRecall: number };
};

function loadCases(): GoldenCase[] {
  if (!existsSync(goldenDir)) return [];
  return readdirSync(goldenDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(goldenDir, f), "utf8")) as GoldenCase);
}

function modelsToRun(cases: GoldenCase[]): string[] {
  const needsModel = cases.some((c) => c.predicted === undefined);
  if (!needsModel) return ["offline"];
  const list = (process.env.EVAL_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : [getModelConfig().model];
}

async function scoreCase(c: GoldenCase, model: string): Promise<CaseScore> {
  const empty = { caseId: c.id, model, flagRecall: 0, criticalFlagRecall: 0, missedFlags: c.expected.flags };
  let extraction: ExtractedReturn;
  try {
    if (c.predicted !== undefined) {
      const parsed = parseExtractedReturn(c.predicted);
      if (!parsed.success) throw new Error("predicted output fails the schema");
      extraction = parsed.data;
    } else {
      extraction = await extractReturn(c.documents, {
        dataClass: "anonymized",
        model,
        clientId: c.id,
        taxYear: c.taxYear,
      });
    }
  } catch (err) {
    const fields = Object.entries(c.expected.fields).map(([path, expected]) => ({ path, expected, actual: undefined, correct: false }));
    return { ...empty, fields, fieldAccuracy: 0, error: (err as Error).message };
  }
  const fields = scoreFields(c.expected.fields, flatten(extraction));
  const { flags } = runRules({ current: extraction, previous: c.previous });
  const correct = fields.filter((f) => f.correct).length;
  return {
    caseId: c.id,
    model,
    fields,
    fieldAccuracy: fields.length === 0 ? 1 : correct / fields.length,
    ...scoreFlags(c.expected.flags, flags),
  };
}

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function report(summaries: Summary[]) {
  const lines = [
    "| Model | Cases | Errors | Field accuracy | Flag recall | Critical flag recall | Pass |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...summaries.map(
      (s) =>
        `| ${s.model} | ${s.cases} | ${s.errors} | ${pct(s.fieldAccuracy)} | ${pct(s.flagRecall)} | ${pct(s.criticalFlagRecall)} | ${passes(s, config.launchThreshold) ? "yes" : "no"} |`,
    ),
  ];
  const md = `## Evals\n\nThreshold: field accuracy ${pct(config.launchThreshold.fieldAccuracy)}, critical flag recall ${pct(config.launchThreshold.criticalFlagRecall)}.\n\n${lines.join("\n")}\n`;
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

async function main() {
  const cases = loadCases();
  if (cases.length === 0) {
    const msg = "WARNING: evals/golden has zero cases. Passing so the pipeline runs. Add anonymized cases (EVALS.md).";
    console.warn(msg);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Evals\n\n${msg}\n`);
    return;
  }

  const summaries: Summary[] = [];
  const all: CaseScore[] = [];
  for (const model of modelsToRun(cases)) {
    const scores: CaseScore[] = [];
    for (const c of cases) scores.push(await scoreCase(c, model));
    all.push(...scores);
    summaries.push(summarize(model, scores));
  }

  mkdirSync(join(root, "runs"), { recursive: true });
  writeFileSync(join(root, "runs", "latest.json"), JSON.stringify({ at: new Date().toISOString(), summaries, cases: all }, null, 2));
  report(summaries);

  // With several models, the run passes when the configured APP_MODEL (or the first listed) passes.
  const primary = summaries[0]!;
  if (!passes(primary, config.launchThreshold)) {
    console.error(`Evals below the launch threshold for ${primary.model}.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

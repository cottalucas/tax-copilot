/**
 * Eval runner (EVALS.md).
 *   npm run evals        offline, on every pull request: validates every case, scores recorded
 *                        outputs (evals/recorded, golden "predicted") with schema, scoring and rules.
 *                        Never calls a model.
 *   npm run evals:live   live (live-evals-pr.yml on every pull request, nightly, live-evals.yml):
 *                        sends each case's documents as files (text cases as generated PDFs) to
 *                        EXTRACT_MODEL through src/models for at most
 *                        budgets.json liveEvalMaxCalls cases, within liveEvalMaxCostUsd, and
 *                        writes new recordings to evals/runs/recorded. Add --media to include the
 *                        scan and photo set (main and laptop runs only).
 * Fails below the launch threshold, on any injection field changed, on a malformed case, on an
 * empty injection set, or when the live budget is passed.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import budgets from "../budgets.json" with { type: "json" };
import { runRules } from "../rules/index.js";
import { extractReturn, type DocumentFile } from "../src/extraction/extract.js";
import { BudgetExceededError, CostBudget, getModelConfig } from "../src/models/index.js";
import { parseExtractedReturn } from "../src/schema/extraction.js";
import { CaseFile, Recording } from "./lib/case-schema.js";
import { modelInputsHash } from "./lib/inputs-hash.js";
import { textPdf } from "./lib/pdf.js";
import { flatten, passes, scoreFields, scoreFlags, summarize } from "./lib/score.js";
import type { CaseScore, GoldenCase } from "./lib/types.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const config = JSON.parse(readFileSync(join(root, "config.json"), "utf8")) as {
  launchThreshold: { fieldAccuracy: number; criticalFlagRecall: number };
};
const live = process.argv.includes("--live");
// Scan and photo cases run live only on main (live-evals.yml, nightly) and from a laptop. Pull
// request live runs keep to golden and injection: main's verifier scores only those (SR-28).
const media = process.argv.includes("--media");
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function write(md: string) {
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
}

/** Loads a folder of cases. The folder sets the kind: a case cannot relabel itself. */
export function loadDir(dir: string, kind: "golden" | "injection" | "media"): { cases: GoldenCase[]; invalid: string[] } {
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

/** The documents the model gets: text cases as generated text PDFs, media cases as their files. */
export function caseFiles(c: GoldenCase): DocumentFile[] {
  const text = (c.documents ?? []).map((d) => ({ file: d.file, mimeType: "application/pdf" as const, data: textPdf(d.pages).toString("base64") }));
  const binary = (c.attachments ?? []).map((a) => ({ file: a.file, mimeType: a.mimeType, data: readFileSync(join(root, "media", "files", a.path)).toString("base64") }));
  return [...text, ...binary];
}

/** A recording counts only if it was made from the current prompt and model code. */
function recordedOutput(c: GoldenCase, hash: string): unknown {
  if (c.kind === "golden" && c.predicted !== undefined) return c.predicted;
  const file = join(root, "recorded", `${c.id}.json`);
  if (!existsSync(file)) return undefined;
  const rec = Recording.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!rec.success) throw new Error(`evals/recorded/${c.id}.json is malformed`);
  return rec.data.inputsHash === hash ? rec.data.output : undefined;
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
export function pickLive(cases: GoldenCase[], max: number, offset = 0, unrecorded: (c: GoldenCase) => boolean = () => false): GoldenCase[] {
  const golden = cases.filter((c) => c.kind === "golden").sort((a, b) => a.id.localeCompare(b.id));
  const rank = (c: GoldenCase) => (c.id.startsWith("inj-") ? 0 : 1);
  const ordered = cases.filter((c) => c.kind !== "golden").sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  const missing = ordered.filter(unrecorded);
  if (missing.length > 0) {
    // Fill first with cases that have no current recording, then the rest in order.
    return [...golden, ...missing, ...ordered.filter((c) => !unrecorded(c))].slice(0, max);
  }
  const rest = ordered;
  const room = Math.max(0, max - golden.length);
  if (rest.length === 0 || room === 0) return golden.slice(0, max);
  const start = ((offset * room) % rest.length + rest.length) % rest.length;
  const window = Array.from({ length: Math.min(room, rest.length) }, (_, i) => rest[(start + i) % rest.length]!);
  return [...golden, ...window].slice(0, max);
}

async function main() {
  const golden = loadDir("golden", "golden");
  const injection = loadDir("injection", "injection");
  const mediaSet = loadDir("media", "media");
  const invalid = [...golden.invalid, ...injection.invalid, ...mediaSet.invalid];
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
  const all = [...golden.cases, ...injection.cases, ...mediaSet.cases];
  const scores: CaseScore[] = [];
  let calls = 0;
  let costUsd = 0;
  let unscored = 0;

  if (!live) {
    // Offline needs a recording for every injection case, so the pull request's schema, scoring
    // and rules code is always run against real model outputs. Record with npm run evals:live.
    const hash = modelInputsHash(join(root, ".."));
    const missing = injection.cases.filter((c) => recordedOutput(c, hash) === undefined).map((c) => c.id);
    if (missing.length) {
      write(`## Evals (offline)\n\nFAILED: no recording made from the current prompt and model code for: ${missing.join(", ")}. Run live evals and commit the new recordings.`);
      process.exitCode = 1;
      return;
    }
    for (const c of all) {
      const output = recordedOutput(c, hash);
      if (output === undefined) unscored += 1;
      else scores.push(score(c, output, "recorded"));
    }
  } else {
    const model = getModelConfig("extract").model;
    const inputsHash = modelInputsHash(join(root, ".."));
    const budget = new CostBudget(budgets.liveEvalMaxCostUsd, { requireCost: true, maxCalls: budgets.liveEvalMaxCalls });
    mkdirSync(join(root, "runs", "recorded"), { recursive: true });
    try {
      const offset = Number(process.env.EVAL_OFFSET ?? 0) || 0;
      const first = media ? mediaSet.cases : [];
      // Cases without a current recording go first, so a pull request that changes model inputs
      // gets every case recorded by the trusted proxy across a few pushes (10 calls each).
      const unrecorded = (c: GoldenCase) => recordedOutput(c, inputsHash) === undefined;
      const picked = [...first, ...pickLive([...golden.cases, ...injection.cases], budgets.liveEvalMaxCalls - first.length, offset, unrecorded)];
      for (const c of picked) {
        let output: unknown;
        try {
          output = await extractReturn(caseFiles(c), { dataClass: "anonymized", clientId: c.id, taxYear: c.taxYear, budget });
        } catch (err) {
          if (err instanceof BudgetExceededError) throw err;
          output = { error: (err as Error).message };
        }
        writeFileSync(join(root, "runs", "recorded", `${c.id}.json`), JSON.stringify({ model, recordedAt: new Date().toISOString(), inputsHash, output }, null, 2) + "\n");
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
  const med = scores.filter((s) => mediaSet.cases.some((c) => c.id === s.caseId));
  const ms = med.length ? summarize("media", med) : undefined;
  const gs = g.length ? summarize("golden", g) : undefined;
  const is = inj.length ? summarize("injection", inj) : undefined;
  const goldenPass = !gs || passes(gs, config.launchThreshold);
  const injectionPass = !is || (is.fieldAccuracy === 1 && is.errors === 0);
  // Scans and photos must extract every expected field (synthetic documents, exact values).
  const mediaPass = !ms || (ms.fieldAccuracy === 1 && ms.errors === 0);
  const summary = {
    mode: live ? "live" : "offline",
    cases: all.length,
    scored: scores.length,
    unscored,
    calls,
    costUsd: Number(costUsd.toFixed(6)),
    golden: gs ? { cases: gs.cases, fieldAccuracy: gs.fieldAccuracy, criticalFlagRecall: gs.criticalFlagRecall } : null,
    injection: is ? { cases: is.cases, fieldsHeld: is.fieldAccuracy } : null,
    media: ms ? { cases: ms.cases, fieldAccuracy: ms.fieldAccuracy } : null,
    pass: goldenPass && injectionPass && mediaPass,
  };
  mkdirSync(join(root, "runs"), { recursive: true });
  writeFileSync(join(root, "runs", "summary.json"), JSON.stringify({ ...summary, scores }, null, 2));
  write(
    [
      `## Evals (${summary.mode})`,
      "",
      `Cases: ${summary.cases}, scored: ${summary.scored}, not yet recorded: ${summary.unscored}.`,
      live ? `Model calls: ${calls} of ${budgets.liveEvalMaxCalls}. Cost: ${costUsd.toFixed(4)} USD of ${budgets.liveEvalMaxCostUsd} USD.` : "Model calls: 0 (offline).",
      `Golden: ${gs ? `${pct(gs.fieldAccuracy)} fields, ${pct(gs.criticalFlagRecall)} critical flags` : "no scored cases"}. Injection: ${is ? `${pct(is.fieldAccuracy)} fields held over ${is.cases} cases` : "no scored cases"}. Scans and photos: ${ms ? `${pct(ms.fieldAccuracy)} fields over ${ms.cases} cases` : "not run"}.`,
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

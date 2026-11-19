# EVALS.md

Source: Notion "Tax Copilot for Expatify, Product Doc", EVALS section. Runner: `npm run evals`.

## Golden set
- 10 to 20 past returns, anonymized, with her final submitted values as truth.
- Location: `evals/golden/*.json`, one file per case. Format in `evals/golden/README.md`.
- Today: zero cases. The runner passes with a warning until cases exist.
- No golden case lands while the repo is public (Linear SR-23, AGENTS.md > Never do).
- Anonymized before entering the repo: no names, AHV numbers, IBANs, addresses, or identifying
  employer names. The secret guard blocks AHV and CH IBAN patterns.

## Deterministic checks
- Schema valid: model output parsed by the Zod schema in `src/schema/extraction.ts`.
- All required fields present: enforced by the schema.
- Every value has source file and page: enforced by the schema.
- Totals match source PDFs: TODO once PDF parsing lands (SR-18).

## Metrics
- **Field accuracy**: exact match per expected field, pooled over all cases.
  correct fields / expected fields. A case that errors counts every field as wrong.
- **Flag recall**: expected flags raised / expected flags, averaged per case.
- **Critical flag recall**: lowest over all cases. One missed critical flag fails the run.
- Cost and latency per call come back from `src/models` (to add to the report in SR-18).

## Launch threshold
Proposed, she confirms: 98% field accuracy, zero missed critical flags.
Stored in `evals/config.json`. Changes only by a dated entry in PROGRESS.md.

## Prompt injection set
`evals/injection/*.json`: synthetic documents that hide instructions for the model (override a
value, add a fake deduction, break out of the page tags). Every expected field must hold, and
`null` means the field must stay absent. One miss fails the run. Allowed while the repo is public
because the cases hold no client data. `renderDocuments` also neutralizes page tags in document
text, covered by unit tests.

## Cost budget
Each run stops and fails when model cost passes `evalMaxCostUsd` in `budgets.json` (1 USD).
OpenRouter reports cost per call. A call without a reported cost fails the run, so spend is
always verified. Extraction asks for at most 2000 output tokens.

## Judge
Never for numbers. An LLM judge is allowed later only for free text such as flag explanations,
with a written rubric. None today.

## Model comparison
Set `EVAL_MODELS` (comma separated) as a repository variable or in `.env`. The runner scores the
same set per model and prints one row each. The first model decides the golden threshold. The
injection set must hold for every model: one miss by any model fails the run.

## Regression rule
Every correction she makes becomes a new golden case or a new rule with a test (SR-22).

## When it runs
On every pull request (Linear SR-15) and nightly. Fails when OPENROUTER_API_KEY or APP_MODEL is
missing.
See AGENTS.md > Pipeline.

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
`evals/injection/*.json`: 15 cases from the public BIPIA benchmark (Microsoft, MIT, one attack
per category) hidden in synthetic salary statements, plus 3 hand written attacks on tax data
(override a value, add a fake deduction, break out of the page tags). Every expected field must hold, and
`null` means the field must stay absent. One miss fails the run. Allowed while the repo is public
because the cases hold no client data. `renderDocuments` also neutralizes page tags in document
text, covered by unit tests.

## Cost budget
Live runs stop and fail at `liveEvalMaxCalls` (10) model calls or `liveEvalMaxCostUsd` (0.25 USD)
in `budgets.json`. Every call is priced from `config/model-prices.json`; a call without a price
fails the run. Extraction asks for at most 2000 output tokens.

## Judge
Never for numbers. An LLM judge is allowed later only for free text such as flag explanations,
with a written rubric. None today.

## Offline and live
- Offline (`npm run evals`, every pull request): validates every case file, then scores recorded
  outputs (`evals/recorded/`, golden `predicted`) with the schema, scoring and rules. No Google
  login, no model call.
- Live (`npm run evals:live`): calls EXTRACT_MODEL (Vertex `gemini-3.1-flash-lite`, `eu`) for at
  most 10 cases: golden first, then a rotating window of injection cases. Runs on pull requests
  that change model inputs as a trusted harness (main's code, the pull request's prompts and case
  JSON only), nightly with rotation (all 18 cases within two nights), and by hand from main.
  Signed in as github-evals (Vertex only). Writes recordings to commit to `evals/recorded/`.

## Regression rule
Every correction she makes becomes a new golden case or a new rule with a test (SR-22).

## When it runs
Offline on every pull request. Live on pull requests that change model inputs (trusted harness:
prompt and case changes run live before merge, code changes run live after merge), nightly, and
by hand from main after a model related merge (AGENTS.md > Definition of done). About 0.01 USD per
live run, about 0.50 USD a month, inside the 10 CHF monthly budget.

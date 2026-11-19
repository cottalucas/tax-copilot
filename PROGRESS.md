# PROGRESS.md

## Current focus
SR-15: repo, pipeline and eval harness. Scaffolding done, waiting on keys for the final test.

## Next up
1. Lucas: secrets, variables, Firestore location, Linear integration (SETUP.md).
2. Agent, final test: run infra.yml, one green and one blocked pull request, branch rule, close SR-15.
3. SR-16: login and home queue.

## Log

### 2026-11-19 Final test (prompt 2)
Done: removed the preview stage and FIREBASE_SERVICE_ACCOUNT. Review now gates pull requests (fails
unless "Verdict: Approve"). Evals and review fail when their key is missing. infra.yml is keyless
(Workload Identity Federation). Repo variables set. This pull request adds a skip link to the client
queue (DESIGN.md accessibility) and a secret guard note for golden cases.
Verified: `npm run check`, `npm run test:unit`, `npm run test:e2e` locally. CI result in the pull request.

### 2026-11-18 Setup run (prompt 1, unattended)
Done:
- Created cottalucas/golden-template (private, template flag on): 12 topic files plus README,
  FEEDBACK, CLAUDE pointer. Each under 80 lines.
- Created cottalucas/tax-copilot from the template. Filled every .md from Notion and Linear.
- Code: model adapter (`src/models`, OpenRouter plus Vertex stub, data residency guard), Zod
  extraction schema with source per value, rules interface plus one example rule, eval runner,
  Cloud Functions health endpoint in europe-west6, web shell, Firestore default deny rules.
- Workflows: push, pr, nightly, claude, infra. Jobs skip with a warning when a secret is missing.
- GAPS.md written.
Verified locally, no keys: `npm run check`, `npm run test:unit` (32 tests),
`npm run test:integration` (3 rules tests, Firestore emulator), `npm run test:e2e` (1 smoke),
`npm run evals` (zero cases, warning), `npm run build:functions`, `actionlint` clean.
CI: first push failed on two setup bugs, fixed on main the same day: the `lib/` ignore pattern
hid `evals/lib/` (now `/lib/`), and the `changes` job lost `contents: read`. After the fix, demo
pull request #1 is green: check, test:unit, test:integration, test:e2e ran and passed; evals,
preview and review skipped with a warning (no keys).
Not done: infra deploy, preview, review and evals with keys, branch rule (final test).

## Assumptions
| Date | Assumption | Confirm with |
| --- | --- | --- |
| 2026-11-18 | golden-template and tax-copilot did not exist. Created both as private repos under cottalucas | Lucas |
| 2026-11-18 | Linear has no blocking relations set. Task order follows the journey numbering (0 to 7) | Lucas |
| 2026-11-18 | Status names: Documents in, Needs review, Ready to fill, Submitted. Notion says "done", Linear SR-22 says "Mark as submitted". Linear wins | Lucas |
| 2026-11-18 | Firebase project id is unknown. `.firebaserc` uses `demo-tax-copilot` (emulator only). Real id comes from repo variable FIREBASE_PROJECT_ID | Lucas |
| 2026-11-18 | Firestore location left as a variable (FIRESTORE_LOCATION). Suggested `eur3` or `europe-west6`. Not created | Lucas, permanent choice |
| 2026-11-18 | Review job uses openai/codex-action with `sandbox: read-only` and posts one comment, updated on reruns | Lucas |
| 2026-11-18 | Example rule "large salary change" with a 20% threshold. Not a tax rule. Threshold to confirm with her | Lucas with her |
| 2026-11-18 | Schema fields (employment, deductions, bank accounts) are a generic Swiss starting set. Canton fields empty, TODO | Lucas with her |
| 2026-11-18 | Web portal uses Vite with plain TypeScript, no UI framework yet. Framework choice left to SR-16 | Lucas |
| 2026-11-18 | Functions source is the repo root (single package), so functions can import `src/` and `rules/` | Agent |
| 2026-11-18 | Installed openjdk@21 and actionlint with Homebrew on this laptop to run the emulator and lint workflows | Lucas |
| 2026-11-18 | Added repo variables beyond the brief: FIREBASE_PROJECT_ID, FIRESTORE_LOCATION, optional EVAL_MODELS | Lucas |
| 2026-11-18 | Hosting has no rewrite to functions yet, so preview channels deploy without functions | Agent |

## Template gaps
- Golden had no answer for "repo does not exist yet". SETUP.md should say the agent creates it
  with `gh repo create --template`.
- Golden QA.md does not say how a required check behaves when it is path filtered. Solved here
  by always running the job and skipping steps. Copy back.
- Golden has no infra workflow pattern (APIs, database create, deploy, health check).
- Golden has no secret guard script to copy. Add one to golden or a shared snippet.
- Java is needed for the Firestore emulator. SETUP.md "Only you" list should mention it, or the
  agent installs it.
- Repo variables FIREBASE_PROJECT_ID and FIRESTORE_LOCATION are not in the Notion list of variables.
- Golden has no rule for keeping a single package versus separate functions package.
- Golden QA.md should warn: job level `permissions` replace the workflow's, so always repeat
  `contents: read`. And anchor ignore patterns (`/lib/`) so they do not hide source folders.
- Golden should say: verify from a clean clone before the first push (caught the ignored folder).

## Open questions
See PRD.md, Open questions (canton, submit owner, data import).

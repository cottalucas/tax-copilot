# AGENTS.md

Rules for every coding agent in this repo. CLAUDE.md points here. Backlog: Linear project Tax
Copilot. Product: PRD.md. System: ARCHITECTURE.md.

## Two kinds of AI
- **Build AI** writes and reviews this repo. Claude Code builds (BUILDER_MODEL, claude.yml).
  Codex reviews every pull request (REVIEWER_MODEL, pr.yml). Keys: ANTHROPIC_API_KEY,
  OPENAI_API_KEY. Build AI never runs inside the product.
- **Product AI** is what the app calls. Only through `src/models`. Vertex AI only, EU multi-region
  endpoint `eu`, one role: EXTRACT_PROVIDER=vertex, EXTRACT_MODEL=gemini-3.1-flash-lite.
- A model switch module that covers both layers is a Template gap, fixed later.

## Commands
| Stage | Command | Notes |
| --- | --- | --- |
| install | `npm ci` | Node 22 (`.nvmrc`) |
| check | `npm run check` | TypeScript, ESLint, secret guard, DESIGN.md lint |
| test:unit | `npm run test:unit` | Vitest, 80% coverage floor on `src/`, network mocked |
| test:integration | `npm run test:integration` | Firestore emulator, needs Java 11+ |
| test:e2e | `npm run test:e2e` | Playwright with axe on the Auth and Firestore emulators (Java 11+) |
| evals | `npm run evals` | Offline: validates cases, scores recorded outputs. No model calls |
| evals:live | `npm run evals:live` | Live on Vertex eu: pull request code in a credential free container behind a trusted proxy, nightly with rotation, live-evals.yml. At most 10 calls |
| build | `npm run build` | Web to `dist/`, functions to `lib/` |
| review | CI only | Codex. Blocks only on a tagged criterion, Never rule or security reason |

## Session starter
Read AGENTS.md, PRD.md, PROGRESS.md and the Linear issue for the task. When Lucas's prompt holds a
plan, that plan is approved: start without waiting. Otherwise propose a plan (issues, order,
acceptance criteria to check) and wait for approval.

## Read this file for this kind of task
| Task | Read |
| --- | --- |
| Any task | AGENTS.md, PRD.md, PROGRESS.md, the Linear issue |
| Data, Firestore, functions, deploy, rollback | ARCHITECTURE.md |
| Product AI: model call, prompt, `src/models`, prices | ARCHITECTURE.md > Models, EVALS.md, `config/model-prices.json` |
| Schema, extraction, rules, eval cases | EVALS.md, ARCHITECTURE.md > Data model |
| Any screen or UI copy | DESIGN.md, skill `nielsen-heuristics-audit` |
| Any text a person reads (copy, docs, pull requests) | skill `stop-slop` |
| Pipeline, workflows, gates, budgets | AGENTS.md > Pipeline, `budgets.json` |
| Secrets, client data, residency | AGENTS.md > Never do, ARCHITECTURE.md > Security |

Skills live in `.agents/skills/` (see its README). Load a skill only when the task needs it.

## Always do
- One plan per session. A plan may cover several related issues.
- Stop at the first failed acceptance check. Report what failed and why. Do not work around it.
- Put the Linear id (SR-n) in the branch name and the pull request title. Quote the issue's
  acceptance criteria in the pull request body and say which ones it covers.
- Small pull requests. Docs change in the same pull request as the code they describe.
- Docs state what the code does today, never what it will do.
- Exception: when Lucas asks for a separate docs pull request, docs may follow the code. The
  pull request body says so.
- Write business rules as code in `rules/`, one test per rule.
- Send every product AI call through `src/models`. Models from variables, keys from secrets.
- Add a Firestore rules test with every allow rule.
- Load `stop-slop` before writing copy, docs, commits or pull request text.
- End each task with a Log entry in PROGRESS.md, in the same pull request.
- When the review blocks, add a row to PROGRESS.md > Review blocks before fixing it.
- When running unattended, log every guess in PROGRESS.md under Assumptions and continue.

## Ask first
- Scope changes, or when Linear and a doc disagree.
- A new dependency on a paid service, a new region, a new model or a new Google Cloud API.
- Any change to `firestore.rules` that allows a read or write.
- Changing a launch threshold, a budget or the coverage floor.
- Deleting work you did not write.
- The same failure twice.

## Never do
- Never commit golden cases, client data or real tax rules while the repo is public (Linear
  SR-23). The repo must be private before any of them lands. GitHub Pro keeps branch rules then.
- Never keep client documents anywhere but the Zurich bucket, and there only while the return is
  open: deleted on submit, and after 30 days at the latest (SR-28). Never in the repo or a dev tool.
- Never store client government credentials.
- Never submit without her final review.
- Never send real client data outside the EU or to any dev tool. Golden cases are anonymized.
- Never call a product model outside `src/models`, or any provider but Vertex on an EU endpoint.
- Never run pull request code with a Google identity. Live evals on pull requests run that code in
  a container with no credentials; only the trusted proxy (main's code) holds the token.
- Never use an LLM judge for numbers.
- Never put a model name in code or workflows, or a secret value anywhere in the repo.
- Never change the locked stack: Firebase Hosting and Auth, Cloud Functions in europe-west6,
  Firestore for status, flags, corrections and extracted values (deleted with the documents).
- Never invent product answers.

## Definition of done
- Every acceptance criterion of the Linear issue passes, checked by a test or a visible check.
- Every gate below passes, including the review.
- PROGRESS.md updated. No secret or client data in the diff.
- A pull request that changes `prompts/`, `src/schema/`, `src/extraction/` or `src/models/` commits
  new recordings from its live-evals-pr `trusted-recordings` artifact to `evals/recorded/` (the
  offline gate fails on stale ones), and logs calls, cost and result in PROGRESS.md.

## Pipeline
No human QA. Every pull request runs every gate. When all pass, the pull request merges itself
(squash). When one fails, the pull request is blocked, the Linear issue gets a comment and the
repo owner is mentioned on the pull request.

| Gate | Job | Fails when |
| --- | --- | --- |
| Types, lint, secrets, DESIGN.md | `check` | Any error, a secret shaped value, a DESIGN.md lint error |
| Regression and budgets | `test:unit` | Any test fails, line coverage on `src/` under 80%, a function over `budgets.json` seconds |
| Firestore rules | `test:integration` | Any rules test fails |
| End to end and accessibility | `test:e2e` | Any Playwright test fails, any WCAG 2.2 AA violation |
| Offline evals | `evals` | A malformed case, an empty injection set, a recorded output under the threshold or with an injection field changed |
| Live evals | `evals:live` status (live-evals-pr.yml) | Every pull request: under the threshold, an injection field changed, over 10 calls or 0.25 USD. Pull request code, no credentials, trusted proxy |
| Dependencies | `audit` | A high or critical advisory in production dependencies |
| Code scanning | CodeQL default setup + ruleset | Any error or warning alert, or a high or critical security alert |
| Review | `review` | Codex blocks with a tagged [CRITERION], [NEVER] or [SECURITY] reason, or its output is malformed |

| Trigger | Workflow |
| --- | --- |
| Push, any branch | push.yml: check, test:unit |
| Pull request | pr.yml, CodeQL default setup. live-evals-pr.yml and automerge.yml (pull_request_target, never pull request code) |
| After pr.yml fails | halt.yml: Linear comment, GitHub mention |
| Nightly 02:00 UTC | nightly.yml: full test:e2e, live evals with rotation, form change check (placeholder) |
| Mention @claude | claude.yml: Claude Code builder (build AI) |
| Manual | live-evals.yml: live evals on Vertex (github-evals). infra.yml, main only: Google Cloud setup and deploy (github-deployer) |

- Required on main: a pull request plus every gate above. Admins included. No approvals.
  Branches need not be up to date (GitHub auto merge does not update them).
- github-deployer signs in only from infra.yml on main, enforced in Google Cloud (bound to
  refs/heads/main). github-evals can only call Vertex.
- The reviewer loads from the base commit and runs in a trusted folder, so a pull request cannot
  change its own reviewer. It judges the criteria the pull request body quotes. Rules:
  `scripts/review-rules.md`.

## Secrets and variables
Names only. A human sets secret values. Agents never see them.
- Secrets: ANTHROPIC_API_KEY, OPENAI_API_KEY (build AI), LINEAR_API_KEY.
- Build AI: BUILDER_MODEL, REVIEWER_MODEL.
- Product AI: EXTRACT_PROVIDER, EXTRACT_MODEL, VERTEX_PROJECT_ID, VERTEX_REGION,
  EXTRACT_ALLOWED_EMAILS (who may run extraction; set by Lucas).
- Infra: FIREBASE_PROJECT_ID, FIRESTORE_LOCATION, GCP_WIF_PROVIDER and GCP_DEPLOY_SA (infra.yml),
  GCP_WIF_EVALS_PROVIDER and GCP_EVALS_SA (live evals).

## Conflict order
Linear wins on scope. Never do wins on data. ARCHITECTURE.md wins on technical shape. The latest
PROGRESS.md entry wins on history.

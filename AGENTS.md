# AGENTS.md

Rules for every coding agent in this repo (Claude Code, Codex, Cursor, others). CLAUDE.md points
here. Backlog: Linear project Tax Copilot. Product: PRD.md. System: ARCHITECTURE.md.

## Commands
| Stage | Command | Notes |
| --- | --- | --- |
| install | `npm ci` | Node 22 (`.nvmrc`) |
| check | `npm run check` | TypeScript, ESLint, secret guard |
| test:unit | `npm run test:unit` | Vitest, network mocked |
| test:integration | `npm run test:integration` | Firestore emulator, needs Java 11+ |
| test:e2e | `npm run test:e2e` | Playwright. First run: `npx playwright install chromium` |
| evals | `npm run evals` | Golden set runner, needs OPENROUTER_API_KEY when cases exist |
| build | `npm run build` | Web to `dist/`, functions to `lib/` |
| review | CI only | Codex, model from REVIEWER_MODEL. Must say "Verdict: Approve" |

## Session starter
Read AGENTS.md, PRD.md, PROGRESS.md and the Linear issue for the task. Propose the plan: which
issues, in what order, which acceptance criteria you will check. Wait for approval before writing
code.

## Read this file for this kind of task
| Task | Read |
| --- | --- |
| Any task | AGENTS.md, PRD.md, PROGRESS.md, the Linear issue |
| Data, Firestore, functions, deploy, rollback | ARCHITECTURE.md |
| Any model call, prompt, `src/models` | ARCHITECTURE.md > Models, EVALS.md |
| Schema, extraction, rules, golden cases | EVALS.md, ARCHITECTURE.md > Data model |
| Any screen or UI copy | DESIGN.md, skill `nielsen-heuristics-audit` |
| Any text a person reads (copy, docs, pull requests) | skill `stop-slop` |
| Pipeline, workflows, gates | AGENTS.md > Pipeline |
| Secrets, client data, residency | AGENTS.md > Never do, ARCHITECTURE.md > Security |

Skills live in `.agents/skills/` (see its README). Load a skill only when the task needs it.

## Always do
- One plan per session. A plan may cover several related issues.
- Stop at the first failed acceptance check. Report what failed and why. Do not work around it.
- Put the Linear id (SR-n) in the branch name and the pull request title.
- Small pull requests. Docs change in the same pull request as the code they describe.
- Docs state what the code does today, never what it will do.
- Exception: when Lucas asks for a separate docs pull request, docs may follow the code. The
  pull request body says so.
- When the review blocks, add a row to PROGRESS.md > Review blocks before fixing it.
- Write business rules as code in `rules/`, one test per rule.
- Send every model call through `src/models`. Models from variables, keys from secrets.
- Add a Firestore rules test with every allow rule.
- Load `stop-slop` before writing copy, docs, commits or pull request text.
- End each task with a Log entry in PROGRESS.md, in the same pull request.
- When running unattended, log every guess in PROGRESS.md under Assumptions and continue.

## Ask first
- Scope changes, or when Linear and a doc disagree.
- A new dependency on a paid service, a new region, or a new Google Cloud API.
- Any change to `firestore.rules` that allows a read or write.
- Changing a launch threshold, a budget or the coverage floor.
- Deleting work you did not write.
- The same failure twice.

## Never do
- Never commit golden cases, client data or real tax rules while the repo is public (Linear
  SR-23). The repo must be private before any of them lands. GitHub Pro keeps branch rules then.
- Never store client documents outside her Google Drive.
- Never store client government credentials.
- Never submit without her final review.
- Never send real client data outside the EU or to any dev tool. Golden cases are anonymized.
- Never send real client data to OpenRouter. Client data goes only to Vertex AI in an EU region.
  `src/models` enforces this with `dataClass`.
- Never use an LLM judge for numbers.
- Never put a model name in code or workflows, or a secret value anywhere in the repo.
- Never change the locked stack: Firebase Hosting and Auth, Cloud Functions in europe-west6,
  Firestore for status, flags and corrections only.
- Never invent product answers.

## Definition of done
- Every acceptance criterion of the Linear issue passes, checked by a test or a visible check.
- Every required pipeline job passes (below). The review job says "Verdict: Approve".
- PROGRESS.md updated. No secret or client data in the diff.

## Pipeline
No human QA on pull requests. A pull request halts when tests, evals or review fail.

| Trigger | Workflow | Jobs |
| --- | --- | --- |
| Push, any branch | push.yml | check, test:unit |
| Pull request | pr.yml | changes, check, test:unit, test:integration, test:e2e, evals, review |
| Nightly 02:00 UTC | nightly.yml | full test:e2e, full evals, form change check (placeholder) |
| Mention @claude | claude.yml | Claude Code builder, model from BUILDER_MODEL |
| Manual | infra.yml | Google Cloud setup, keyless auth |

- Required on main: a pull request plus every pr.yml job. Admins included. No approvals.
- `test:e2e` runs when app code changes. `evals` runs on every pull request (Linear SR-15).
- `evals` and `review` fail when their key or model variable is missing.
- The reviewer reads the acceptance criteria from the Linear issue named in the title or branch.
- The reviewer blocks only for an unmet claimed criterion, a broken Never rule or a security
  issue, tagged [CRITERION], [NEVER] or [SECURITY] (`scripts/review-rules.md`). Everything else is
  a comment. It loads from the base commit, so a pull request cannot change its own reviewer.

## Secrets and variables
Names only. A human sets secret values. Agents never see them.
- Secrets: ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, LINEAR_API_KEY.
- Variables: MODEL_PROVIDER, APP_MODEL, EVAL_MODELS, BUILDER_MODEL, REVIEWER_MODEL,
  FIREBASE_PROJECT_ID, FIRESTORE_LOCATION, GCP_WIF_PROVIDER, GCP_DEPLOY_SA.

## Conflict order
Linear wins on scope. Never do wins on data. ARCHITECTURE.md wins on technical shape. The latest
PROGRESS.md entry wins on history.

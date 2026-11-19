# QA.md

Pipeline stages from golden-template/QA.md, bound to this project's tools.

## Stage map
| Stage | Tool | Command | Workflow job |
| --- | --- | --- | --- |
| check | TypeScript, ESLint, secret guard | `npm run check` | push, pr: `check` |
| test:unit | Vitest, network mocked | `npm run test:unit` | push, pr: `test:unit` |
| test:integration | Firebase Emulator, Firestore rules tests | `npm run test:integration` | pr: `test:integration` |
| test:e2e | Playwright, one smoke test | `npm run test:e2e` | pr: `test:e2e`, nightly |
| evals | Golden set runner | `npm run evals` | pr: `evals`, nightly |
| review | Codex via openai/codex-action, model from REVIEWER_MODEL. Fails on "Changes requested" | `scripts/review-prompt.mjs`, `scripts/post-review.mjs` | pr: `review` |
| preview | Removed 2026-11-19. No human QA on pull requests | none | none |

## When each runs
| Trigger | Workflow | Stages |
| --- | --- | --- |
| Push, any branch | push.yml | check, test:unit |
| Pull request | pr.yml | check, test:unit, test:integration, test:e2e*, evals, review |
| Nightly 02:00 UTC | nightly.yml | full test:e2e, full evals, government form change check (placeholder) |
| Mention @claude | claude.yml | Claude Code builder, model from BUILDER_MODEL |
| Manual | infra.yml | APIs, Firestore, rules, hosting, functions, health check. Keyless auth |

## Path filters
\* test:e2e runs when app code changes: `web/`, `src/`, `rules/`, `tests/e2e/`, `firebase.json`,
`firestore.rules`, `package*.json`, `vite.config.ts`, `playwright.config.ts`.
evals run on every pull request (Linear SR-15). Nightly runs the full set too.
Skipped jobs still run and report green with a notice, so the branch rule can require them.

## Required checks on main
Pull request required, no human approval required. Required jobs: `changes`, `check`,
`test:unit`, `test:integration`, `test:e2e`, `evals`, `review`. A pull request halts when tests,
evals or review fail.

## Missing secret behavior
| Job | Needs | Without it |
| --- | --- | --- |
| evals | OPENROUTER_API_KEY, APP_MODEL | Fails |
| review | OPENAI_API_KEY, REVIEWER_MODEL | Fails |
| claude | ANTHROPIC_API_KEY, BUILDER_MODEL | Skips with a warning |
| infra | FIREBASE_PROJECT_ID, FIRESTORE_LOCATION, GCP_WIF_PROVIDER, GCP_DEPLOY_SA | Fails with the missing names |

## Rules
- Never a model name in code or workflows. Variables only.
- Model calls in unit tests use a mocked network.
- Each Firestore allow rule ships with a rules test.
- A smoke test proves the pipeline: one green pull request, one blocked broken pull request.
- No human QA on pull requests. The review job is the reviewer: it fails unless the verdict is
  Approve, and a review with no verdict fails closed.

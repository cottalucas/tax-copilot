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
| review | Codex via openai/codex-action, model from REVIEWER_MODEL | `scripts/review-prompt.mjs` | pr: `review` |
| preview | Firebase Hosting preview channel | `npm run preview` | pr: `preview` |

## When each runs
| Trigger | Workflow | Stages |
| --- | --- | --- |
| Push, any branch | push.yml | check, test:unit |
| Pull request | pr.yml | check, test:unit, test:integration, test:e2e*, evals*, preview, review |
| Nightly 02:00 UTC | nightly.yml | full test:e2e, full evals, government form change check (placeholder) |
| Mention @claude | claude.yml | Claude Code builder, model from BUILDER_MODEL |
| Manual | infra.yml | APIs, Firestore, rules, hosting, functions, health check |

## Path filters
\* test:e2e runs when app code changes: `web/`, `src/`, `rules/`, `tests/e2e/`, `firebase.json`,
`firestore.rules`, `package*.json`, `vite.config.ts`, `playwright.config.ts`.
\* evals run when eval inputs change: `prompts/`, `src/schema/`, `src/extraction/`, `src/models/`,
`rules/`, `evals/`.
Skipped jobs still run and report green with a notice, so the branch rule can require them.

## Required checks on main
Pull request required. Required jobs: `check`, `test:unit`, `test:integration`, `test:e2e`,
`evals`, `preview`, `review`. Set after keys are in (final test).

## Missing secret behavior
| Job | Needs | Without it |
| --- | --- | --- |
| evals | OPENROUTER_API_KEY, APP_MODEL | Skips with a warning |
| preview | FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID | Skips with a warning |
| review | OPENAI_API_KEY, REVIEWER_MODEL | Skips with a warning |
| claude | ANTHROPIC_API_KEY, BUILDER_MODEL | Skips with a warning |
| infra | FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID, FIRESTORE_LOCATION | Fails with the missing names |

## Rules
- Never a model name in code or workflows. Variables only.
- Model calls in unit tests use a mocked network.
- Each Firestore allow rule ships with a rules test.
- A smoke test proves the pipeline: one green pull request, one blocked broken pull request.

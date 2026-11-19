# Tax Copilot

Extraction engine, tax rules and a thin review portal for one Swiss tax preparer. She keeps final
control and submits. Built from [golden-template](https://github.com/cottalucas/golden-template).

## Start here
Agents: read [AGENTS.md](AGENTS.md). Humans: [PRD.md](PRD.md), then [TASKS.md](TASKS.md) and
[PROGRESS.md](PROGRESS.md). Setup gaps against best practice: [GAPS.md](GAPS.md).

## Layout
| Path | What |
| --- | --- |
| `src/models/` | The one model adapter. OpenRouter (dev, evals), Vertex EU (client data, stub) |
| `src/schema/` | Zod extraction schema. Every value has source file and page |
| `src/extraction/` | Extraction through the adapter, output validated |
| `src/functions/` | Cloud Functions, europe-west6 |
| `rules/` | Business rules as code, one test each |
| `prompts/` | The one prompt source per model task |
| `evals/` | Golden set runner, cases in `evals/golden/` |
| `web/` | Portal (Vite, TypeScript) |
| `tests/` | Unit helpers, Firestore rules tests, Playwright smoke |
| `.github/workflows/` | push, pr, nightly, claude, infra |

## Commands
```bash
npm ci
npm run check
npm run test:unit
npm run test:integration   # needs Java 11+ for the Firestore emulator
npm run test:e2e           # first run: npx playwright install chromium
npm run evals
```

No keys are needed for check and tests. Pull requests have no human QA: tests, evals and the
Codex review gate every merge. See [QA.md](QA.md) for when each stage runs.

## Docs
[AGENTS](AGENTS.md) · [PRD](PRD.md) · [ARCHITECTURE](ARCHITECTURE.md) · [TASKS](TASKS.md) ·
[EVALS](EVALS.md) · [PROGRESS](PROGRESS.md) · [DESIGN](DESIGN.md) · [STYLE](STYLE.md) ·
[QA](QA.md) · [MODELS](MODELS.md) · [SECURITY](SECURITY.md) · [SETUP](SETUP.md) ·
[FEEDBACK](FEEDBACK.md) · [GAPS](GAPS.md)

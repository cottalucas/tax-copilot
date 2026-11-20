# Tax Copilot

Extraction engine, tax rules and a thin review portal for one Swiss tax preparer. She keeps final
control and submits. Built from [golden-template](https://github.com/cottalucas/golden-template).

## Start here
Agents: read [AGENTS.md](AGENTS.md). Humans: [PRD.md](PRD.md), then [PROGRESS.md](PROGRESS.md).
Tasks live in Linear, project Tax Copilot.

## Layout
| Path | What |
| --- | --- |
| `src/models/` | Product AI adapter: Vertex Gemini on the EU endpoint only |
| `src/schema/` | Zod extraction schema. Every value has source file and page |
| `src/extraction/` | Extraction through the adapter, output validated |
| `src/functions/` | Cloud Functions, europe-west6 |
| `rules/` | Business rules as code, one test each |
| `prompts/` | The one prompt source per model task |
| `evals/` | Eval runner: offline on pull requests, live on main. Cases in `evals/golden/` and `evals/injection/` |
| `web/` | Portal (Vite, TypeScript) |
| `tests/` | Unit helpers, Firestore rules tests, Playwright smoke |
| `.agents/skills/` | Skills any agent can load: `stop-slop`, `nielsen-heuristics-audit` |
| `.github/workflows/` | push, pr, automerge, halt, nightly, live-evals-pr, claude and chain (build AI), live-evals and infra (main only) |

## Commands
```bash
npm ci
npm run check
npm run test:unit
npm run test:integration   # needs Java 11+ for the Firestore emulator
npm run test:e2e           # first run: npx playwright install chromium
npm run evals              # offline, no model calls
```

No keys are needed for check and tests. Pull requests have no human QA: tests, evals and the
Codex review gate every merge. See [AGENTS.md](AGENTS.md) > Pipeline.

## Docs
[AGENTS](AGENTS.md) · [PRD](PRD.md) · [ARCHITECTURE](ARCHITECTURE.md) · [EVALS](EVALS.md) ·
[DESIGN](DESIGN.md) · [PROGRESS](PROGRESS.md)

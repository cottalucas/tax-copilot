# AGENTS.md

Always-on rules for every coding agent in this repo (Claude Code, Codex, Cursor, others).
CLAUDE.md only points here. Built from golden-template/AGENTS.md.

## Session starter
Read AGENTS.md, PRD.md, TASKS.md and PROGRESS.md. Propose the plan: which tasks, in what order,
which acceptance criteria you will check. Wait for approval before writing code.

Read on demand: ARCHITECTURE.md (cross-component work, data), DESIGN.md (any UI), EVALS.md
(prompts, schema, rules, src/models), MODELS.md (any model call), SECURITY.md (any data),
QA.md (pipeline), STYLE.md (any text a person reads).

## Working rules
- One plan per session. A plan may cover several related tasks.
- Stop at the first failed acceptance check. Report what failed and why. Do not work around it.
- Never invent product answers. Ask. When running unattended, log the guess in PROGRESS.md under
  Assumptions and continue.
- At the end of each task: mark it in TASKS.md, add a Log entry to PROGRESS.md, same pull request.
- Docs change in the same pull request as the code that changes them. Docs state what the code
  does today.
- Small pull requests. Put the Linear id (SR-n) in the branch name and the title.
- Load STYLE.md before writing copy, docs or pull request text.

## Project rules
- Business rules are code with tests, never prompts. They live in rules/, one test per rule.
- Every model call goes through src/models. Models come from variables (APP_MODEL,
  BUILDER_MODEL, REVIEWER_MODEL). Keys come from secrets. Never a model name in code or workflows.
- Never store client documents outside her Google Drive.
- Never store client government credentials.
- Never submit without her final review.
- Never send real client data outside the EU or to any dev tool. Golden cases are anonymized.
- Real client data only through Vertex AI in an EU region. OpenRouter only for dev and anonymized
  evals. src/models enforces this with `dataClass`.
- Never use an LLM judge for numbers.
- Never commit golden cases, client data or real tax rules while the repo is public (Linear
  SR-23). The repo goes private, or GitHub Pro keeps branch rules, before any of them lands.
- Stack is locked: Firebase Hosting and Auth, Cloud Functions in europe-west6, Firestore for
  status, flags and corrections only.

## Commands
| Stage | Command |
| --- | --- |
| check | `npm run check` (TypeScript, ESLint, secret guard) |
| test:unit | `npm run test:unit` (Vitest) |
| test:integration | `npm run test:integration` (Firestore emulator, needs Java 11+) |
| test:e2e | `npm run test:e2e` (Playwright smoke) |
| evals | `npm run evals` (golden set runner) |
| review | runs in CI only (Codex, REVIEWER_MODEL). Must say "Verdict: Approve" |

## Definition of done
- Every acceptance criterion of the task passes, checked by a test or a visible check.
- check, test:unit and test:integration pass. test:e2e passes when app code changed. evals pass
  when prompts, schema, rules, src/models or evals changed.
- TASKS.md and PROGRESS.md updated. No secret or client data in the diff.
- The review job approves. No human QA: a failed test, eval or review halts the pull request.

## Escalate when
- Scope changes, or Linear and a doc disagree.
- A change needs a new paid service or a new region.
- Any data would leave the EU or reach a dev tool.
- The same failure happens twice.
- You would delete work you did not write.

## Conflict order
Linear wins on scope. SECURITY.md wins on anything about data. ARCHITECTURE.md wins on technical
shape. The latest PROGRESS.md entry wins on history.

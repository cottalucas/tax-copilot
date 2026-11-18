# QA.md

## Purpose
The pipeline, by stage name, not by tool. The CI calls fixed commands. Each project decides what
runs behind them.

## Required sections
- **Stage map**: table of stage, tool bound in this project, command.
- **When each runs**: the trigger table below, with any project changes.
- **Path filters**: the exact folders that count as app code and as eval inputs.
- **Required checks**: which jobs the branch rule on main requires.
- **Missing secret behavior**: what each job does when its secret is absent.

## Stages
| Stage | Golden says | Typical binding |
| --- | --- | --- |
| `check` | Required. Types, lint, secret guard | tsc, eslint |
| `test:unit` | Required. Fast, no network | vitest, jest, pytest |
| `test:integration` | Optional. Real services in emulators | emulator suite |
| `test:e2e` | Optional. One smoke test minimum | playwright |
| `evals` | Required if the product calls a model | golden set runner |
| `review` | Required. Model from a variable | Codex, Claude |
| `preview` | Optional. A link per pull request | hosting preview channel |

## When each runs
| Trigger | Stages | Budget |
| --- | --- | --- |
| Push, any branch | check, test:unit | under 2 min |
| Pull request | check, test:unit, test:integration, test:e2e*, evals*, preview, review | 10 to 15 min |
| Nightly | full test:e2e, full evals, external change checks | while you sleep |

\* `test:e2e` only when app code changes. `evals` only when prompts, schema, rules, the model
adapter or the eval cases change. Docs edits skip both.

## Rules
- Stage names are fixed. Scripts with these exact names exist in every project.
- A job whose secret is missing skips with a clear message and exits green, until the secret
  exists. Then it is required.
- Path-filtered jobs still report a status, so the branch rule can require them.
- Never a model name in code or workflows. Models come from repository variables.
- Pin action versions. Give workflows the least permissions they need.
- Main is protected: pull request required, every pull request job required.
- A smoke test proves the pipeline: one green pull request and one blocked broken pull request.

## Best known references
- Practical test pyramid (Fowler): https://martinfowler.com/articles/practical-test-pyramid.html
- Google, just say no to more end to end tests:
  https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html
- Google engineering practices, code review: https://google.github.io/eng-practices/review/
- GitHub Actions security hardening:
  https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- GitHub rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- DORA metrics: https://dora.dev

## What worked in past projects
- Super Ramble: one CI job with secret guard, build, offline evals and a syntax check kept main
  green. Separate steps made each failure visible on its own.
- Super Ramble: an emulator integration test caught a server-only crash that unit tests missed.
- Super Ramble lesson: one deploy shipped a model setting that broke every live call within a
  minute. Gate model setting changes behind evals.

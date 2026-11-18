# Golden Template

The reference every new project starts from. One file per topic, each a short summary: what the
project must fill, the rules we always follow, the best public guides, and lessons from past builds.

It is a summary, not a manual. Tools are chosen per project. Golden names stages, not tools.

## Files

| File | Topic | Project copy fills it from |
| --- | --- | --- |
| [AGENTS.md](AGENTS.md) | Always-on rules for any coding agent | Golden rules + project Never list |
| [PRD.md](PRD.md) | Problem, user, metrics, scope | Notion Product Doc, PRD section |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System, data model, decisions | Notion Product Doc, ARCHITECTURE section |
| [TASKS.md](TASKS.md) | Queue of tasks with acceptance criteria | Linear project issues |
| [EVALS.md](EVALS.md) | Golden set, scoring, launch threshold | Notion Product Doc, EVALS section |
| [PROGRESS.md](PROGRESS.md) | Session memory | Starts empty: Log, Assumptions, Template gaps |
| [DESIGN.md](DESIGN.md) | Screens, states, visual rules | Linear journey issues + Notion |
| [STYLE.md](STYLE.md) | Writing rules, no AI slop | Copied as is |
| [QA.md](QA.md) | Pipeline stages and when they run | Copied, then each stage bound to a tool |
| [MODELS.md](MODELS.md) | Model adapter, providers, variables | Copied, then providers chosen |
| [SECURITY.md](SECURITY.md) | Data rules, secrets, residency | Notion Never list + data residency |
| [SETUP.md](SETUP.md) | The two prompt flow, who does what | Copied from Notion Golden Project Setup |
| [FEEDBACK.md](FEEDBACK.md) | How a project's gap report flows back here | Copied as is |

## How an agent uses this repo

1. Read this README, then [SETUP.md](SETUP.md).
2. Create the project repo. Copy every topic file to the project root under the same name.
3. Fill each file's **Required sections** from the Notion project doc and Linear. Keep section
   names unchanged, so Notion and the repo map one to one.
4. Drop the **Best known references** and **What worked** blocks from project copies, or keep them
   as a footer. Keep **Rules**.
5. Bind each stage in [QA.md](QA.md) to a real command in the project's build tool.
6. Log every guess in the project's PROGRESS.md under Assumptions, and every missing piece of
   Golden under Template gaps. [FEEDBACK.md](FEEDBACK.md) sends those back here.

## Shape of every topic file

```
Purpose            one or two lines
Required sections  the skeleton a project fills
Rules              what we always do
Best known refs    strongest public standards, linked, not copied
What worked        lessons from ai-builder-series and Super Ramble
```

Hard limit: 80 lines per file. If a topic needs more, it belongs in the project, not here.

## Not in this repo

No GitHub Actions, no code. Workflows and code live in each project, because they depend on the
tools chosen. A project such as tax-copilot is the worked example.

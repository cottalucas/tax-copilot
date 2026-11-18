# AGENTS.md

## Purpose
Always-on rules for any coding agent (Claude Code, Codex, Cursor, others). Every tool reads this
file first. CLAUDE.md and other tool files hold one line that points here.

## Required sections
- **Session starter**: the exact files to read, then propose a plan and wait for approval.
- **Read order**: AGENTS, PRD, TASKS, PROGRESS always. ARCHITECTURE, DESIGN, EVALS, MODELS,
  SECURITY when the task touches them.
- **Commands**: the stage commands from QA.md, with the real script names.
- **Project rules**: the Never list from the PRD, data rules, locked stack.
- **Definition of done**: acceptance criteria pass, stages green, docs and PROGRESS updated.
- **Escalate when**: the list of moments the agent stops and asks.
- **Conflict order**: which file wins when two disagree.

## Rules
- One plan per session. The plan can cover several related tasks. Stop at the first failed
  acceptance check and report.
- Never invent product answers. Ask, or log an assumption in PROGRESS.md when running unattended.
- Business rules are code with tests, never prompts.
- Every model call goes through the one adapter in MODELS.md. Models from variables, keys from
  secrets. Never a model name or a key in code or workflows.
- Update PROGRESS.md and mark the task in TASKS.md at the end of every task.
- Docs change in the same pull request as the code that changes them.
- Load STYLE.md before writing any user-facing text, doc or pull request description.
- Small pull requests. One task per pull request when possible.
- Conflict order: Linear wins on scope, ARCHITECTURE wins on technical shape, SECURITY wins on
  everything about data.
- Escalate on: scope change, new dependency on a paid service, data leaving its region, same
  failure twice, deleting work you did not write.

## Best known references
- AGENTS.md open convention: https://agents.md
- Claude Code memory files and best practices:
  https://docs.anthropic.com/en/docs/claude-code/memory and
  https://www.anthropic.com/engineering/claude-code-best-practices
- Effective context engineering for agents:
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Building effective agents (keep workflows simple first):
  https://www.anthropic.com/engineering/building-effective-agents
- Agent skills, loaded only when needed:
  https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview
- Spec-driven development kit: https://github.com/github/spec-kit

## What worked in past projects
- ai-builder-series: AGENTS.md as the conductor, CLAUDE.md as a pointer, worked across tools.
- ai-builder-series: an explicit escalation list stopped silent scope creep.
- Super Ramble: "challenge conflicts before building" caught doc versus code drift early.
- Super Ramble: a definition of done with exact commands made "done" checkable.
- Super Ramble lesson: one doc said a value was encrypted when it was not. Rule: docs state what
  the code does today, never what it will do.
- Chapter 2 change: one plan per session beats one task per session with current agents.

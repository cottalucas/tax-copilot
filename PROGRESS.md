# PROGRESS.md

## Purpose
Session memory. What happened, what we guessed, what Golden was missing. Every session starts
by reading it. Without it every session starts from zero.

## Required sections
- **Current focus**: one line.
- **Next up**: the next one to three tasks, by TASKS.md number.
- **Log**: dated entries, newest first. What was done, what was verified, what is not done.
- **Assumptions**: every guess made without the owner, with date and who must confirm.
- **Template gaps**: every manual step or missing rule Golden did not cover. FEEDBACK.md
  carries these back to Golden and Notion.
- **Open questions**: waiting on a human, with the task each blocks.

## Rules
- Update at the end of every task, in the same pull request.
- Log entries are short: done, verified, not done. Three to eight lines.
- State what was verified and how. "Tests pass" names the command.
- Never paste secrets, tokens, client names or client data into the log.
- Assumptions stay until a human confirms or rejects them. Then mark the outcome, do not delete.
- When the Log passes about 200 lines, move old entries to docs/log-archive.md.

## Best known references
- Anthropic, long running agent sessions and progress files:
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Keep a Changelog, for release level history: https://keepachangelog.com
- Architecture Decision Records, for decisions that outlive the log: https://adr.github.io

## What worked in past projects
- ai-builder-series: progress.md with Current focus, Last session, Next up gave clean handoffs
  between sessions and tools.
- Super Ramble: an append-only resolution log with "decisions not to relitigate" stopped agents
  reopening settled choices.
- Super Ramble lesson: the resolution log reached about 10,000 lines and became too long to
  read each session. Cap the log and archive.
- Super Ramble lesson: real secrets landed in the log and forced a git history rewrite. Run a
  secret guard on every push.

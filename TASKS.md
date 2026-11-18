# TASKS.md

## Purpose
The work queue. Each task gives the agent everything it needs: what, why, done when.
Linear is the source of truth. This file mirrors it for agents that work offline.

## Required sections
- **Source**: link to the Linear project, and the date of the last sync.
- **Tasks**: one block per task, in dependency order, in the format below.

Task format (AI Builder Series, Chapter 2):

```
## Task N: <title> (<LINEAR-ID>)
Status: [ ] Not started | [~] In progress | [x] Done
Depends on: Task M, or none

Description:
Outcome in one line. Then two to four lines of context.

Acceptance criteria:
- [ ] Testable statement
- [ ] Testable statement
```

## Rules
- One task per journey step, end to end. Ten to twenty tasks per milestone.
- Every acceptance criterion is testable by a command, a test or a visible check.
- Linear wins over Notion on scope. Copy titles and criteria from Linear word for word.
- The agent marks Status and updates PROGRESS.md when a task completes. A human verifies.
- A task blocked by an open question names it in Depends on.
- Never mark a task done with a failing criterion. Stop and report instead.

## Best known references
- Shape Up, scopes and hill charts: https://basecamp.com/shapeup
- User story acceptance criteria, Given When Then (Fowler):
  https://martinfowler.com/bliki/GivenWhenThen.html
- GitHub Spec Kit, task breakdown from specs: https://github.com/github/spec-kit
- Linear method: https://linear.app/method

## What worked in past projects
- Chapter 2: the task format with Status, Depends on and acceptance criteria made agent
  sessions predictable.
- Chapter 2 change: one plan per session covering several tasks, stopping at the first failed
  check, was faster than one task per session.
- Super Ramble: handing a dated finding to an agent as the spec for a fix worked well. A task
  is a spec.
- Super Ramble lesson: tasks without a definition of done turned into multi-round polish
  passes. Write the criteria first.

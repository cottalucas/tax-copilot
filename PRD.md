# PRD.md

## Purpose
The product contract. What problem, for whom, how we measure it, and what we will never do.
The agent reads it every session.

## Required sections
Names match the Notion Product Doc and AI Builder Series Chapter 2, so setup is a straight copy.
- **Validated problem**: what we observed, with evidence (numbers, cases, quotes).
- **User**: who uses it, how many, what control they keep.
- **Stages**: Validated, Minimum lovable, Full version. Mark the current one.
- **Core flow**: numbered steps of the main journey, one line each.
- **North Star Metric**: one number that rises when users get value. Baseline and target.
- **Guardrail metrics**: two to four numbers that must not get worse while the North Star rises.
- **Metrics**: any other measures, with how each is collected.
- **Now (committed)**: what this milestone ships.
- **Next (directional)**: what comes after, not committed.
- **Never**: strategic and safety exclusions. These become rules in AGENTS.md and SECURITY.md.
- **Open questions**: each with an owner and the task it blocks.

## Rules
- Evidence beats opinion. Every claim in Validated problem points to an observation.
- Targets are written before the first real data, or marked "set after N real cases".
- Every Never item becomes a test, a rule or a review check. A Never with no enforcement is a gap.
- Linear holds the backlog. The PRD holds scope. When they disagree, Linear wins and the PRD
  is updated in the same pull request.
- Open questions that block a task are listed in that task's Depends on.

## Best known references
- AI Builder Series, Chapter 2 PRD worked example (Notion, The AI Builder Series).
- Amazon Working Backwards PR/FAQ:
  https://www.workingbackwards.com/resources/working-backwards-pr-faq
- North Star framework (Amplitude): https://amplitude.com/books/north-star
- Shape Up, appetite and fixed scope: https://basecamp.com/shapeup
- Now, Next, Later roadmaps (ProdPad):
  https://www.prodpad.com/blog/invented-now-next-later-roadmap/
- Lenny Rachitsky's PRD templates collection:
  https://www.lennysnewsletter.com/p/my-favorite-templates-issue-37

## What worked in past projects
- ai-builder-series: a stage flag (0 to 1 versus 1 to scale) told the agent how much rigor to
  apply. Keep it as the Stages section.
- ai-builder-series: separate "always true" docs from "true at scale" docs kept the PRD short.
- Super Ramble: an explicit Out of scope line ended repeated debates about live audio. Write
  Never items as one line each, with the reason.
- Super Ramble lesson: the brief stayed at 57 lines and stayed read. The roadmap grew to 900
  lines and drifted. Keep the PRD under two pages.
- Chapter 2 change: for one expert user, replace "5 real users" with "10 real cases with every
  correction logged".

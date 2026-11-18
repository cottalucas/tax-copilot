# FEEDBACK.md

## Purpose
How each project's lessons flow back into Golden and Notion, so the next setup takes less time.

## Required sections (project side)
- **PROGRESS.md, Template gaps**: running list during the build.
- **GAPS.md**: one report at setup end and at each milestone end.

## GAPS.md entry format
```
## <short name>
Missing: what is not there today.
Why it matters: the risk or the cost, in one or two lines.
Update: <Notion page> > <section>, and/or golden-template/<FILE>.md > <section>.
Severity: high | medium | low
```

## The loop
1. During the build, the agent adds each manual step or missing rule to PROGRESS.md under
   Template gaps.
2. At setup end and at each milestone end, the agent writes GAPS.md: every gap, compared against
   the best known references in Golden, with the exact Notion page and section to update.
3. You review GAPS.md and pick what to adopt.
4. Adopted gaps update the Notion page first (Notion is the source for project docs), then the
   matching Golden file in one pull request to golden-template.
5. Golden's pull request lists the project and gap names it closes.
6. Rejected gaps get one line in the project's PROGRESS.md: rejected, with the reason.

## Rules
- Notion first, Golden second, so both stay in step.
- A gap that repeats in two projects goes to the top of the list.
- Keep Golden files under 80 lines. If a fix makes a file longer, cut something.
- Manual steps that repeat become an agent step in SETUP.md "Who does what".

## Best known references
- Google SRE, blameless postmortems: https://sre.google/sre-book/postmortem-culture/
- Architecture Decision Records: https://adr.github.io

## What worked in past projects
- Super Ramble: pipeline-learnings.md held only real findings from real traces. Same discipline
  here: a gap needs evidence from a real project.
- Notion Golden Project Setup: "note every manual step, automate it into the template next time".

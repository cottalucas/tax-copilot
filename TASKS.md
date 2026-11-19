# TASKS.md

Source: Linear project "Tax Copilot", SR-15 to SR-22. Synced 2026-11-18.
https://linear.app/cottalucas/project/tax-copilot-07d82d29bc2a
Linear wins over Notion on scope. Titles and criteria copied word for word.
Depends on: Linear has no blocking relations set. Order below follows the journey (assumption).

## Task 0: Repo, pipeline and eval harness (SR-15)
Status: [x] Done
Depends on: none

Description:
Outcome: every change is checked automatically.
Setup run built the repo, stages, workflows and eval runner. Final test ran 2026-11-19. The repo
went public so GitHub allows a branch rule on main.

Acceptance criteria:
- [x] Repo created from the template, with AGENTS.md at the root
- [x] GitHub Action runs tests and the golden set on each pull request (the `evals` job runs on
      every pull request since 2026-11-19. Linear wins over the Notion path filter)
- [x] Reviewer model comments on each pull request, model set by variable
- [x] Merge blocked when tests or evals fail (branch rule on main, all pr.yml jobs required,
      admins included. Pull request #3 with a broken unit test showed BLOCKED)

## Task 1: Login and home queue (SR-16)
Status: [ ] Not started
Depends on: Task 0

Description:
Outcome: she sees what needs her next.

Acceptance criteria:
- [ ] Firebase Auth login
- [ ] Clients grouped by status, flagged first
- [ ] Row shows name, status, flag count
- [ ] Empty state when there are zero clients

## Task 2: New return and intake (SR-17)
Status: [ ] Not started
Depends on: Task 1

Description:
Outcome: client files are in place.

Acceptance criteria:
- [ ] Create a client
- [ ] Drop PDFs or pick a Drive folder
- [ ] Files stay in her Drive, nothing stored elsewhere
- [ ] Status shows Documents in

## Task 3: Extraction (SR-18)
Status: [ ] Not started
Depends on: Task 2, canton decision (PRD.md Open questions) for canton fields

Description:
Outcome: one clean data file per client.

Acceptance criteria:
- [ ] Output validated against the schema
- [ ] Every value stores source file and page
- [ ] Runs in batch
- [ ] Field accuracy reported on golden cases

## Task 4: Rules and flags (SR-19)
Status: [ ] Not started
Depends on: Task 3, canton decision for tax rules

Description:
Outcome: deductions applied, risks surfaced.

Acceptance criteria:
- [ ] Rules written as code, each with a test
- [ ] Each flag has a plain language reason
- [ ] Status moves to Needs review or Ready to fill

## Task 5: Review screen (SR-20)
Status: [ ] Not started
Depends on: Task 4

Description:
Outcome: she checks only the exceptions.

Acceptance criteria:
- [ ] Flags first, then key totals, then changes from last year
- [ ] Clicking a value opens its source page
- [ ] Approve button sets Ready to fill

## Task 6: Fill handoff (SR-21)
Status: [ ] Not started
Depends on: Task 5, open questions on submit owner and data import

Description:
Outcome: draft filled on the government site.

Acceptance criteria:
- [ ] Fill now opens one dedicated tab
- [ ] Claude in Chrome fills from the client data file using the saved form map
- [ ] Time to fill recorded and compared to the 19 minute baseline

## Task 7: Done and next client (SR-22)
Status: [ ] Not started
Depends on: Task 6

Description:
Outcome: the loop closes fast.

Acceptance criteria:
- [ ] Mark as submitted
- [ ] Next client reuses the same tab
- [ ] Her corrections are saved as new eval cases

## Task 8: Make the repo private before any golden case or tax rule (SR-23)
Status: [ ] Not started
Depends on: none. Must be done before the first golden case or real tax rule lands

Description:
Outcome: no client derived data or expert know how is ever public.
The repo is public for now, so branch rules work on the free plan. AGENTS.md carries the rule.

Acceptance criteria:
- [ ] Repo is private, or GitHub Pro is active with branch rules still on
      (AGENTS.md is stricter: the repo must be private. Pro only keeps branch rules on)
- [ ] Done before the first golden case lands in evals/golden
- [ ] Done before the first real tax rule lands in rules/

## Task 9: Scaffolding layer: lean docs, gates, skills, infra (SR-24)
Status: [~] In progress
Depends on: Task 0. Blocks Task 1

Description:
Outcome: SR-15 loose ends closed and the scaffolding layer finished. No domain work.

Acceptance criteria:
- [x] SR-15 doc updates on main (this pull request)
- [x] Public repo rule in AGENTS.md (this pull request)
- [ ] Only the kept files exist. AGENTS.md under 150 lines with the read table
- [ ] Every gate runs and a failing one blocks the merge
- [ ] A green pull request merges itself. A red one posts to Linear
- [ ] Both skills installed and referenced
- [ ] Firestore exists in europe-west6, Auth enabled
- [ ] PROGRESS.md log and Template gaps updated

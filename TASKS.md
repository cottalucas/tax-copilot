# TASKS.md

Source: Linear project "Tax Copilot", SR-15 to SR-22. Synced 2026-11-18.
https://linear.app/cottalucas/project/tax-copilot-07d82d29bc2a
Linear wins over Notion on scope. Titles and criteria copied word for word.
Depends on: Linear has no blocking relations set. Order below follows the journey (assumption).

## Task 0: Repo, pipeline and eval harness (SR-15)
Status: [~] In progress
Depends on: none

Description:
Outcome: every change is checked automatically.
Setup run built the repo, stages, workflows and eval runner. Keys and branch rule come next.

Acceptance criteria:
- [x] Repo created from the template, with AGENTS.md at the root
- [ ] GitHub Action runs tests and the golden set on each pull request
- [ ] Reviewer model comments on each pull request, model set by variable
- [ ] Merge blocked when tests or evals fail

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

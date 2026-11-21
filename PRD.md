# PRD.md

Source: Notion "Tax Copilot for Expatify, Product Doc", PRD section. Scope from Linear project
"Tax Copilot" (SR-15 to SR-22). Linear wins on scope.

## Validated problem
The tax preparer handles about 11 returns a day when documents are complete. Around 90% of cases
are routine: read PDFs, extract numbers, apply known deductions, fill the government online form.
Only a few cases need judgment.

Evidence: a prototype with Claude projects and Claude in Chrome filled one full return in 19
minutes. Slow, but correct.

## User
One expert user: the tax preparer. She keeps final control and submits.

## Stages
- **Validated (done):** Claude project plus Claude in Chrome. Works, 19 minutes per return.
- **Minimum lovable (current):** thin web portal plus extraction engine plus Claude in Chrome
  for filling.
- **Full version (later):** own Chrome extension with field overlay, flags on the page, source
  PDF in a side panel.

## Core flow
1. She opens the portal and picks or creates a client.
2. She picks the tax year and drops the documents: PDFs, scans or phone photos. They go to a
   private bucket in Zurich (SR-28). Importing from Google Drive comes later (SR-27).
3. Extraction runs on the server: Gemini on Vertex `eu` reads the documents itself. One client,
   or all waiting clients in a batch.
4. She sees the result: flags first, key totals, big changes from last year.
5. She clicks Fill now. The government site opens in one dedicated tab.
6. She logs in as the client. Claude in Chrome fills the draft from the extracted values.
7. She reviews the draft on the government site and submits.
8. She clicks Next client. Same tab is reused.

## North Star Metric
TODO (gap, see PROGRESS.md > Open gaps). Candidate: returns per day reaching "Submitted" with no field changed
by her after Fill now.

## Guardrail metrics
TODO (gap, see PROGRESS.md > Open gaps). Candidates: field accuracy versus her submitted version at least 98%,
zero missed critical flags, zero client data outside the EU.

## Metrics
- Minutes per return, from documents in to draft ready. Baseline about 40. Target set after 10
  real returns, because daily volume varies a lot.
- Field accuracy versus her final submitted version.

## Now (committed)
Linear SR-15 to SR-22: repo and pipeline, login and home queue, new return and
intake, extraction, rules and flags, review screen, fill handoff, done and next client.

## Next (directional)
TODO (gap, see PROGRESS.md > Open gaps). From the Product Doc stages: own Chrome extension with field overlay,
flags on the page, source PDF side panel. End user portal as a second door to the same engine.

## Never
- Store client documents anywhere but her own Drive or the Zurich documents bucket, and in the
  bucket only while the return is open (deleted on submit, 30 days at the latest).
- Store client government credentials.
- Submit without her final review.

## Open questions
| Question | Owner | Blocks |
| --- | --- | --- |
| Which canton forms are in scope first? | Lucas with her | SR-18 canton fields, SR-19 tax rules, SR-21 form map, nightly form check |
| Who presses submit: her or the client? | Lucas with her | SR-21, SR-22 |
| Does the canton accept a data import, which could remove the browser step? | Lucas | SR-21 |

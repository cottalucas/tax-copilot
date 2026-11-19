# GAPS.md

Gap report from the setup run, 2026-11-18. Compares the Notion docs and this setup against the
best known references in golden-template (each topic file lists them). Format and flow:
FEEDBACK.md. Notion pages are named by title, then section heading.

Severity: **high** blocks a task or a launch, **medium** costs time or adds risk, **low** polish.

## Top five
1. North Star and guardrail metrics (high)
2. Data model (high)
3. Security section: residency, processors, incident steps (high)
4. Open questions: canton first (high, blocks SR-18, SR-19, SR-21)
5. Rollback and observability (medium, before first real client)

---

## 1. North Star and guardrail metrics
Missing: one North Star Metric with baseline and target, and two to four guardrails. The Product
Doc has "minutes per return" and "field accuracy" with no target.
Why it matters: without a North Star the team optimises the wrong thing. Without guardrails a
speed gain can hide accuracy loss. Chapter 2 makes both part of the PRD contract.
Update: Notion "Tax Copilot for Expatify, Product Doc" > PRD > Metrics. Split into "North Star
Metric" and "Guardrail metrics" (names from Chapter 2 > The PRD.md worked example). Then PRD.md.
Severity: high

## 2. Now and Next split
Missing: "Now (committed)" and "Next (directional)". The Product Doc has Stages but no committed
versus directional scope. The "TASKS (first slice)" section is also stale versus Linear.
Why it matters: agents treat everything written as in scope. Now and Next stops scope creep.
Update: Product Doc > PRD > Stages: add "Now (committed)" pointing to Linear SR-15 to SR-22 and
"Next (directional)". Product Doc > TASKS (first slice): mark superseded by Linear or delete.
Severity: medium

## 3. Data model
Missing: entities, fields, where each lives, who reads it. ARCHITECTURE has Stack only.
Where the extracted client data file lives is not decided.
Why it matters: SR-16 and SR-17 write Firestore documents. Without a model, rules and tests are
guesses, and the Never list (no documents outside Drive) cannot be checked. Draft in
ARCHITECTURE.md > Data model.
Update: Product Doc > ARCHITECTURE: new section "Data model" after "Stack". Decide the client
data file location (her Drive is the default).
Severity: high

## 4. Security section
Missing: a security section. No data inventory, no allowed regions per data kind, no list of
processors (Google, Anthropic via Vertex), no incident steps, no nFADP notification duty, no MFA
rule for her account, no prompt injection threat.
Why it matters: tax data is sensitive personal data under the Swiss nFADP. OWASP LLM Top 10 ranks
prompt injection first, and client PDFs are untrusted input. Draft in SECURITY.md.
Update: Product Doc > ARCHITECTURE: new section "Security" (link to repo SECURITY.md), and
Product Doc > PRD > Never: add "send real client data outside the EU or to a dev tool".
Severity: high

## 5. Design
Missing: screens, states and visual rules. Linear has outcomes per screen, Notion has none.
Why it matters: agents build blank or happy-path only screens without states. The review screen
order (flags, totals, changes) is a product decision that needs to be written once.
Update: Product Doc: new top-level section "DESIGN" with screens SR-16 to SR-22 and their five
states. Draft in DESIGN.md.
Severity: medium

## 6. Rollback
Missing: rollback commands and criteria.
Why it matters: Chapter 2 go-live checklist requires both before launch, not during an incident.
Update: Product Doc > ARCHITECTURE: new section "Rollback". Chapter 2 > Before you ship, Rollback
items become a task in Linear before the first real client.
Severity: medium

## 7. Observability
Missing: what is logged, what is measured, how cost is tracked, what alerts exist.
Why it matters: minutes per return and field accuracy cannot be measured without instrumentation.
Chapter 2: "Instrumentation comes before launch."
Update: Product Doc > ARCHITECTURE: new section "Observability". Add a Linear issue for metrics
instrumentation before SR-21.
Severity: medium

## 8. Open questions in the Product Doc
Missing: answers, owners and the tasks each blocks.
- Which canton forms are in scope first? Blocks SR-18 canton fields, SR-19 tax rules, SR-21 form
  map, the nightly form check.
- Who presses submit: her or the client? Blocks SR-21 and SR-22.
- Does the canton accept a data import? Could remove SR-21's browser step.
Why it matters: three of eight Linear issues cannot finish without these answers.
Update: Product Doc > Open questions: add owner and "blocks" per question. Linear: add the
canton decision as a blocking issue for SR-18 and SR-19.
Severity: high

## 9. Linear blocking relations
Missing: SR-15 to SR-22 have no "blocks" relations. Golden Project Setup says issues block each
other in order.
Why it matters: the Linear coding agent and the small loop automation pick the next issue by order.
Update: Linear project Tax Copilot: set SR-15 blocks SR-16, and so on to SR-22.
Severity: medium

## 10. Context engineering for extraction
Missing: one good output example, the failure mode we fear most, and the signal that shows it
works (Chapter 2 > Context engineering, three questions).
Why it matters: the prompt in `prompts/extraction.md` is a first draft without examples.
Update: Product Doc > ARCHITECTURE > Key decisions, or a new "Extraction design" section.
Severity: medium

## 11. Golden set ownership and anonymization
Missing: who anonymizes, how, and a date for the first 10 cases.
Why it matters: evals pass with zero cases today. The launch threshold means nothing until cases
exist.
Update: Product Doc > EVALS: add "Anonymization steps" and "Owner and date". Golden Project
Setup > Who does what > Only you: already lists "build the golden set with the expert".
Severity: high

## 12. Chapter 2 entry gate
Missing: proof of "10 real cases with every correction logged" (proposed change in Chapter 2).
Today there is one 19 minute run.
Why it matters: the validated problem rests on one case.
Update: AI Builder Series > Chapter 2 > Before you start: adopt the proposed change. Product Doc >
PRD > Validated problem: add the case count.
Severity: medium

## 13. Golden Project Setup page out of step with the repo
Missing: the Notion page lists AGENTS, PRD, ARCHITECTURE, TASKS, EVALS, PROGRESS, DESIGN and a
style guide, but not QA, MODELS, SECURITY, SETUP, FEEDBACK. Variables FIREBASE_PROJECT_ID and
FIRESTORE_LOCATION are missing. Java for the emulator is missing.
Why it matters: the setup prompt is generated from Notion. Missing items become manual steps.
Update: Notion "Golden Project Setup" > Setup todo (now) > Agent, and > Who does what. Mirror in
golden-template/SETUP.md.
Severity: medium

## 14. Keyless deploy auth
Missing: the Workload Identity Federation pool and service account. infra.yml now uses keyless
auth (2026-11-19) and FIREBASE_SERVICE_ACCOUNT is gone, but the agent was not allowed to create
the GCP identity, so a human runs SETUP.md > Keyless deploy once.
Why it matters: infra.yml cannot deploy until then. No key file means nothing to leak.
Update: Notion "Golden Project Setup" > Who does what > Only you: add "create the keyless deploy
identity (one command block)". Remove the service account key step from Setup todo.
Severity: medium

## 15. Cost cap
Missing: a daily model spend cap and a cost per return target.
Why it matters: batch extraction on 11 returns a day with retries can surprise the bill.
Update: Product Doc > PRD > Metrics (cost per return), ARCHITECTURE > Key decisions (cap).
Severity: low

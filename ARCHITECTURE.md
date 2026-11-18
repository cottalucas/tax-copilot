# ARCHITECTURE.md

## Purpose
Load-bearing technical decisions. What the system is made of, where data lives, what breaks
first. Read when a task crosses components.

## Required sections
Names match the Notion Product Doc ARCHITECTURE section, plus the Chapter 2 additions.
- **Principle**: one or two lines on what the core of the product is.
- **Stack**: one line per layer: tool and job. Mark it locked or open.
- **Data model**: every stored entity, its fields, where it lives, who can read it.
- **Data flow**: where each kind of data goes, region by region. A small diagram is fine.
- **Key decisions**: dated, one line each, with the reason. Longer ones become ADRs in docs/adr/.
- **Security**: link to SECURITY.md, plus auth model and access rules summary.
- **Observability**: logs, metrics, traces, cost tracking. What we look at when it breaks.
- **Rollback**: exact command to roll back each deployable, and the criteria to do it.
- **What breaks first**: ranked risks, each with the signal that shows it.

## Rules
- Region and residency are decided before the first deploy. Some locations can never change.
- Store the minimum. Every stored field has a reason in the data model.
- Engine first, front door second: business logic lives in server code, not in UI or prompts.
- Every external call (model, API) goes through one module per provider type, so it can be
  swapped and mocked.
- Any decision that is hard to reverse gets a dated entry with the alternatives considered.
- Rollback is written before launch, not during an incident.

## Best known references
- C4 model for diagrams at the right zoom level: https://c4model.com
- arc42 architecture template: https://arc42.org
- Architecture Decision Records: https://adr.github.io and Michael Nygard's original post
  https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- The Twelve-Factor App (config in the environment): https://12factor.net
- Google Cloud Architecture Framework: https://cloud.google.com/architecture/framework
- Google SRE workbook, SLOs: https://sre.google/workbook/implementing-slos/

## What worked in past projects
- Super Ramble: a store interface shape that never changed without a doc change let the
  local store and the Firestore store swap cleanly.
- Super Ramble lesson: Firebase Hosting rewrites cut requests at about 60 seconds while the
  Function allowed 120. Write every timeout in the chain into Stack.
- Super Ramble lesson: a code comment and the architecture doc both claimed encryption that
  was never wired. State current behavior only.
- Super Ramble lesson: architecture.md grew to 790 lines. Move history to the log, keep the
  current shape here.
- ai-builder-series: "What breaks first" made risk reviews quick and concrete.

# ARCHITECTURE.md

Source: Notion "Tax Copilot for Expatify, Product Doc", ARCHITECTURE section, plus decisions from
this setup. Sections marked TODO are gaps listed in GAPS.md.

## Principle
The engine is the product: extraction, tax rules, form filling. The portal is the first front
door. A later end user portal is a second door to the same engine.

## Stack
Locked unless marked open.

| Layer | Tool | Where in repo |
| --- | --- | --- |
| Portal | Web app on Firebase Hosting, Firebase Auth | `web/` (Vite, TypeScript) |
| Engine | Cloud Functions v2, region europe-west6 (Zurich) | `src/functions/` |
| Extraction | Model call through the adapter, fixed JSON schema, Zod validated | `src/extraction/`, `src/schema/`, `prompts/` |
| Models | One adapter. OpenRouter for dev and evals. Vertex AI EU for client data | `src/models/` |
| Rules | Plain code with tests, not prompts | `rules/` |
| Storage | Firestore: client status, flags, corrections only. No documents | `firestore.rules` |
| Files | Stay in her Google Drive, read through the Drive API | TODO SR-17 |
| Filling | Claude in Chrome with one saved shortcut that holds the form field map | TODO SR-21 |
| Pipeline | GitHub Actions, stages in QA.md | `.github/workflows/` |

Timeouts to keep in mind: Firebase Hosting rewrites to functions cut at about 60 seconds.
Extraction runs as a background job, not behind a Hosting rewrite.

## Data model
TODO (gap). Draft, to confirm in SR-16 and SR-17:
- `clients/{clientId}`: displayName (her label, not legal name), taxYear, status
  (`documents_in`, `needs_review`, `ready_to_fill`, `submitted`), driveFolderId, flagCount,
  updatedAt.
- `clients/{clientId}/flags/{flagId}`: ruleId, severity, field, reason, resolved.
- `clients/{clientId}/corrections/{id}`: field, before, after, at. Feeds new golden cases.
- Extracted values are not stored in Firestore. TODO: decide where the client data file lives
  (her Drive, next to the PDFs, is the default that satisfies the Never list).

## Key decisions
- 2026-11 Map the government form once and reuse it. Do not reread the page per client.
- 2026-11 Weekly check that the form has not changed. Remap when it does (nightly placeholder).
- 2026-11 AI does extraction. Rules are code. Filling is dumb and fast.
- 2026-11 Every value stores source file and page (enforced by the Zod schema).
- 2026-11 Client data only to Vertex AI EU. Enforced in `src/models` by `dataClass`.
- 2026-11 Firestore rules deny everything by default. Each allow rule ships with a test.

## Security
See SECURITY.md. Auth: Firebase Auth, one user (her). Firestore default deny.

## Observability
TODO (gap). Minimum: Cloud Logging for functions without client data, per call model cost and
latency (returned by `src/models`), eval reports in CI summaries.

## Rollback
TODO (gap). Hosting: `firebase hosting:rollback`. Functions: redeploy the previous tag.
Criteria to be written before first real client.

## What breaks first
1. Government form changes. Signal: nightly form check, fill errors.
2. Unusual documents that do not match the schema. Signal: schema validation failures per case.
3. Login friction per client. Cannot be removed without official access.

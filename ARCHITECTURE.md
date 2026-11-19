# ARCHITECTURE.md

How Tax Copilot is built, where data lives, and how to deploy and roll back. Source: Notion
"Tax Copilot for Expatify, Product Doc", ARCHITECTURE section. TODO marks open gaps (PROGRESS.md).

## Principle
The engine is the product: extraction, tax rules, form filling. The portal is the first front
door. A later end user portal is a second door to the same engine.

## Stack
Locked unless marked open.

| Layer | Tool | Where in repo |
| --- | --- | --- |
| Portal | Web app on Firebase Hosting, Firebase Auth | `web/` (Vite, TypeScript) |
| Engine | Cloud Functions v2, europe-west6 (Zurich) | `src/functions/` |
| Extraction | Model call through the adapter, fixed JSON schema, Zod validated | `src/extraction/`, `src/schema/`, `prompts/` |
| Models | One adapter, four providers, chosen per role by variables. Default Vertex Gemini in the EU | `src/models/` |
| Rules | Plain code with tests, not prompts | `rules/` |
| Storage | Firestore: client status, flags, corrections only. No documents | `firestore.rules` |
| Files | Stay in her Google Drive, read through the Drive API | TODO SR-17 |
| Filling | Claude in Chrome with one saved shortcut holding the form field map | TODO SR-21 |
| Pipeline | GitHub Actions | `.github/workflows/`, AGENTS.md > Pipeline |

Firebase Hosting rewrites to functions cut requests at about 60 seconds. Extraction runs as a
background job, never behind a Hosting rewrite.

## Environments
| Environment | Firebase project | Use |
| --- | --- | --- |
| Local | `demo-tax-copilot` (emulators only, `.firebaserc`) | Tests, development. No real services |
| Live | `tax-co-pilot` (variable FIREBASE_PROJECT_ID) | Her real use. Deploys are manual |
| Staging | none | Template gap. Add before the first real client |

## Data model
Draft, confirmed in SR-16 and SR-17.
- `clients/{clientId}`: displayName (her label, not the legal name), taxYear, status
  (`documents_in`, `needs_review`, `ready_to_fill`, `submitted`), driveFolderId, flagCount,
  updatedAt.
- `clients/{clientId}/flags/{flagId}`: ruleId, severity, field, reason, resolved.
- `clients/{clientId}/corrections/{id}`: field, before, after, at. Feeds new golden cases.
- Extracted values are not stored in Firestore. TODO: the client data file lives in her Drive
  next to the PDFs (default that satisfies the Never list).

## Data inventory and residency
| Data | Lives in | Who reads it |
| --- | --- | --- |
| Client PDFs | Her Google Drive only | Her, the engine through the Drive API |
| Client data file | Her Drive (TODO SR-18) | Her, the fill step |
| Status, flags, corrections | Firestore `(default)`, europe-west6 | Her only |
| Government credentials | Nowhere. She types them per session | Nobody |
| Golden cases | `evals/golden/`, anonymized. None while the repo is public (SR-23) | Pipeline, dev models |

Functions run in europe-west6. Client data reaches models only through Vertex AI in a `europe-*`
region until SR-18 decides residency. Other providers see anonymized or synthetic data only.

## Models
- Adapter: `src/models/index.ts`, `complete(request)`. ESLint blocks `openai`,
  `@anthropic-ai/sdk` and `@google-cloud/vertexai` imports anywhere else.
- Providers: `vertex` (default), `anthropic`, `openai`, `openrouter`. Each role picks one with
  variables, so switching is a variable change only:
  - extract role: EXTRACT_PROVIDER, EXTRACT_MODEL (extraction, evals).
  - check role: CHECK_PROVIDER, CHECK_MODEL (pull request review, UX review).
- Defaults set 2026-11-20: EXTRACT `vertex` + `gemini-2.5-flash-lite` (cheapest Flash Lite on an
  EU regional endpoint), VERTEX_REGION `europe-west4` (europe-west6 has no Flash Lite),
  VERTEX_PROJECT_ID `tax-co-pilot`. CHECK `openai` + `gpt-6.2-sol` (decision 3, a stronger gate).
- Vertex uses keyless Google login: Application Default Credentials locally, Workload Identity
  with the `github-evals` identity (Vertex only) in pull request jobs.
- Cost: OpenRouter reports it, the others are priced from `config/model-prices.json`. Prompt
  caching: Vertex and OpenAI cache stable prefixes on their own, Anthropic gets `cache_control`
  on the system prompt. Cached tokens are counted at the cached price.
- Real client data: today only `vertex` in a `europe-*` region may receive it (`dataClass:
  "client"`). The final residency choice for real client data is made at SR-18.
- No orchestration framework. LangChain only when a feature needs multi step orchestration.
- Only pass the parameters a request sets. Some models reject sampling parameters.

## Security
- Auth: Firebase Auth, one user (her). Google sign-in provider switched on by Lucas in the console.
- Firestore rules deny everything. Each allow rule ships with a test in
  `tests/integration/firestore.rules.test.ts`, including "another user cannot read".
- Threats: prompt injection inside client PDFs (the prompt treats documents as data, output is
  schema validated, rules are code); data reaching a non EU model (blocked in `src/models`);
  takeover of her Google account (TODO: enforce MFA).
- Secret guard in `npm run check` blocks API keys, private keys, AHV numbers, CH IBANs, emails.
  GitHub secret scanning and push protection are on.
- Incident steps and nFADP notification duties: TODO before the first real client.

## Keyless deploy identity
infra.yml signs in with Workload Identity Federation. No key file exists.
- Pool `github`, provider `tax-copilot`, accepts only `cottalucas/tax-copilot`.
- Service account `github-deployer@tax-co-pilot.iam.gserviceaccount.com`. Roles: firebase.admin,
  identitytoolkit.admin, datastore.owner, serviceusage.serviceUsageAdmin, cloudfunctions.admin,
  run.admin, artifactregistry.admin, cloudbuild.builds.editor, iam.serviceAccountUser.
- Created by Lucas on 2026-11-19. Variables GCP_WIF_PROVIDER and GCP_DEPLOY_SA point to it.

## Deploy
Live deploys are manual. Actions > infra > Run workflow.
- Setup only (default): enables APIs, checks Firestore is in FIRESTORE_LOCATION, deploys rules
  and indexes, turns on Firebase Auth (Identity Platform `initializeAuth` when not yet on).
- With "deploy_app" ticked: also deploys hosting and functions, then calls the health check.
- Budgets in `budgets.json`: functions run at most 60 seconds (global option, unit tested).
- From a laptop, logged in with firebase: `npm run build && npx firebase deploy --project tax-co-pilot`.

## Rollback
Decide to roll back when the health check fails, sign in breaks, or she reports wrong values.
- Hosting: Firebase console > Hosting > Release history > Rollback on the last good release. Or
  `npx firebase hosting:clone tax-co-pilot:<VERSION_ID> tax-co-pilot:live` with the version id
  from that list.
- Functions: `git checkout <last good commit> && npm ci && npx firebase deploy --only functions
  --project tax-co-pilot`.
- Firestore rules: same as functions with `--only firestore:rules`.
- Firestore data: no backups yet. TODO: scheduled exports before the first real client.

## Observability
TODO before SR-21: Cloud Logging for functions without client data, model cost and latency per
call (returned by `src/models`), eval reports in CI summaries.

## Key decisions
- 2026-11 Map the government form once and reuse it. Weekly check that it has not changed.
- 2026-11 AI does extraction. Rules are code. Filling is dumb and fast.
- 2026-11 Every extracted value stores source file and page (Zod schema).
- 2026-11 Client data only to Vertex AI EU, enforced in `src/models`.
- 2026-11 Firestore default deny. Firestore `(default)` is in europe-west6 (permanent).
- 2026-11-19 Repo public for free branch rules until SR-23. Keyless deploys.

## What breaks first
1. Government form changes. Signal: nightly form check, fill errors.
2. Unusual documents that do not match the schema. Signal: schema validation failures per case.
3. Login friction per client. Cannot be removed without official access.

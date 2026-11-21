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
| Extraction | The `extract` callable function sends her documents to the model as `gs://` links through the adapter; Gemini reads PDFs, scans and photos itself. Fixed JSON schema, Zod validated, citations checked | `src/functions/extract.ts`, `src/extraction/`, `src/schema/`, `prompts/`, `web/src/batch.ts` |
| Product AI | One adapter, Vertex Gemini on the EU endpoint only | `src/models/` |
| Rules | Plain code with tests, not prompts | `rules/` |
| Storage | Firestore: client status, flags, corrections, and extracted values while the return is open. No documents | `firestore.rules` |
| Files | Cloud Storage, the project's default bucket `tax-co-pilot.firebasestorage.app` in europe-west6. Uploaded from her browser into `users/{uid}/clients/{clientId}/`. Private, deleted on submit and after 30 days, no soft delete | `storage.rules`, `storage-lifecycle.json`, `web/src/main.ts` |
| Filling | Claude in Chrome with one saved shortcut holding the form field map | TODO SR-21 |
| Pipeline | GitHub Actions | `.github/workflows/`, AGENTS.md > Pipeline |

Firebase Hosting rewrites to functions cut requests at about 60 seconds. Extraction runs as a
background job, never behind a Hosting rewrite.

## Environments
| Environment | Firebase project | Use |
| --- | --- | --- |
| Local | `demo-tax-copilot` (emulators only, `.firebaserc`) | Tests, development. No real services |
| Live | `tax-co-pilot` (variable FIREBASE_PROJECT_ID), https://tax-co-pilot.web.app | Her real use. Deploys are manual (infra.yml, main only) |
| Staging | none | Template gap. Add before the first real client |

## Data model
`clients` confirmed in SR-16 (reads) and SR-28 (create, extraction).
- `clients/{clientId}`: ownerUid (her Firebase Auth uid), displayName (her label, not the legal
  name), status (`documents_in`, `needs_review`, `ready_to_fill`, `submitted`), flagCount,
  fileCount, taxYear (she chooses it), createdAt, and extractedAt once values are saved,
  submittedAt once submitted. Rules: she reads only documents where ownerUid is her uid (queries
  filter on it); she creates a client only with exactly those first seven fields, status
  `documents_in` and no flags. No updates or deletes from the browser: the functions (Admin SDK,
  after checking she owns the client) write extractedAt, status and submittedAt.
- `clients/{clientId}/extraction/current`: data (the schema validated extraction, every value with
  source file and page), model, taxYear, sources (the file names), extractedAt, expireAt (30 days
  after the oldest document's upload, when the bucket deletes that document; a Firestore TTL policy
  deletes the values then). She reads her own; only the `extract` function writes, in a
  transaction that refuses once the return is no longer Documents in.
- `clients/{clientId}/flags/{flagId}`: ruleId, severity, field, reason, resolved.
- `clients/{clientId}/corrections/{id}`: field, before, after, at. Feeds new golden cases.
- File names: each upload gets one unique storage name (a repeat becomes `name (2).pdf`), and
  citations use that name, so a value always points at exactly one document.
- Submitting (`submitReturn`) first sets status `submitted` (so a running extraction cannot save
  afterwards), then deletes the extracted values and the files. The button comes with SR-22.

## Data inventory and residency
| Data | Lives in | Who reads it |
| --- | --- | --- |
| Client documents (PDF, JPG, PNG) | Default bucket, europe-west6, `users/{uid}/clients/{clientId}/`. Until submit, 30 days at the latest | Her (Storage rules), the extract function, Vertex `eu` through a `gs://` link |
| Extracted values | Firestore `clients/{id}/extraction/current`, europe-west6. Until submit, 30 days at the latest | Her, the extract function, later the fill step |
| Status, flags, corrections | Firestore `(default)`, europe-west6 | Her only |
| Government credentials | Nowhere. She types them per session | Nobody |
| Golden cases | `evals/golden/`, anonymized. None while the repo is public (SR-23) | Pipeline, live evals on Vertex `eu` |

Functions run in europe-west6. Product AI is Vertex only, on the EU multi-region endpoint `eu`.
Residency decided 2026-11-21 (Lucas, SR-18, SR-28): real client documents may go to Vertex on
`eu`, only through the `extract` function, which sends `gs://` links to the Zurich bucket. No other
model or service receives them. Logs hold counts and cost, never text or values.

## Models
Two kinds of AI (AGENTS.md). Build AI (Claude Code, Codex) never runs in the product. Product AI:
- Adapter: `src/models/index.ts`, `complete(request)`. The only way the product calls a model.
  ESLint blocks `openai`, `@anthropic-ai/sdk` and `@google-cloud/vertexai` imports elsewhere.
- Provider: `vertex` only, behind the `ModelProvider` interface. One role, extract:
  EXTRACT_PROVIDER `vertex`, EXTRACT_MODEL `gemini-3.1-flash-lite`, VERTEX_REGION `eu` (EU
  multi-region endpoint `aiplatform.eu.rep.googleapis.com`), VERTEX_PROJECT_ID `tax-co-pilot`.
- Why `eu`: probed 2026-11-20, this project gets 404 for every Gemini 2.5 model in europe-west1,
  europe-west4 and global, and 3.x models serve only on global and `eu`. europe-west6 serves none.
  `gemini-3.1-flash-lite` is the cheapest that answers in the EU. The adapter refuses global.
- Login: keyless. Application Default Credentials locally. In CI, Workload Identity as
  github-evals (roles/aiplatform.user only), only in jobs that run main's code: the trusted proxy
  for pull request live evals (pull request code runs in a container without credentials),
  nightly and live-evals.yml. `VERTEX_PROXY_URL` points the adapter at that proxy.
- Cost: priced from `config/model-prices.json` (non-global price). Vertex caches stable prompt
  prefixes on its own; cached tokens are priced as cached.
- Real client data: only `vertex` on an EU endpoint may receive it (`dataClass: "client"`),
  decided at SR-18. The `extract` function sends it with `dataClass: "client"`.
- Runtime identity: the `extract` and `submitReturn` functions run as
  `extract-fn@tax-co-pilot.iam.gserviceaccount.com` (roles/aiplatform.user, roles/datastore.user,
  roles/storage.objectAdmin on the documents bucket only). Vertex reads the `gs://` links as its
  service agent (roles/storage.objectViewer on that bucket). Created by Lucas. Their settings (EXTRACT_*, VERTEX_*, EXTRACT_ALLOWED_EMAILS) come from
  repository variables, written to `.env.<project>` by infra.yml at deploy time.
- Cost: one extraction is one model call, capped at `extractMaxCostUsd` (0.05 USD,
  `budgets.json`), and at 30 files of at most 25 MB. Gemini counts about 258 tokens per PDF page
  or image, so a typical client costs well under 0.01 USD.
- A switch module covering build AI and product AI is a Template gap, fixed later.
- No orchestration framework. Only pass the parameters a request sets.

## Security
- Auth: Firebase Auth with Google sign-in (popup), one user (her). The Google provider is switched
  on by Lucas in the console. Tests sign in through the Auth emulator's Google popup.
- Anyone with a Google account can sign in, but only accounts listed in EXTRACT_ALLOWED_EMAILS
  (verified email) can run extraction, so nobody else can spend the model budget. Unset means
  nobody. Both functions also check that the caller owns the client.
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
- Federation is bound per workflow file on main. Two providers in pool `github`, each with an
  attribute condition on GitHub's `job_workflow_ref` claim and a constant `attribute.role`:
  `tax-copilot` (role deploy) and `tax-copilot-evals` (role evals). Each service account trusts
  only its role. A workflow from a pull request branch cannot get either identity.
- Deployer: only `.github/workflows/infra.yml@refs/heads/main`.
- Evals: `github-evals@tax-co-pilot.iam.gserviceaccount.com`, roles/aiplatform.user only, for
  `live-evals-pr.yml`, `nightly.yml` and `live-evals.yml`, each `@refs/heads/main`. Cannot deploy
  or touch data.
- Service account `github-deployer@tax-co-pilot.iam.gserviceaccount.com`. Roles: firebase.admin,
  identitytoolkit.admin, datastore.owner, serviceusage.serviceUsageAdmin, cloudfunctions.admin,
  run.admin, artifactregistry.admin, cloudbuild.builds.editor, iam.serviceAccountUser.
- Created by Lucas on 2026-11-19 (deployer) and 2026-11-20 (evals). Variables GCP_WIF_PROVIDER,
  GCP_DEPLOY_SA and GCP_EVALS_SA point to them.
- Spend: a Google Cloud budget on the project alerts at 50%, 90% and 100% of 10 CHF a month.

## Deploy
Live deploys are manual. Actions > infra > Run workflow.
- Setup only (default): enables APIs, checks Firestore is in FIRESTORE_LOCATION, deploys rules
  and indexes, turns on Firebase Auth (Identity Platform `initializeAuth` when not yet on).
- With "deploy_app" ticked: also writes the functions' settings from repository variables (stops
  if one is missing), deploys hosting and functions, then calls the health check.
- Budgets in `budgets.json`: functions run at most 60 seconds (global option, unit tested).
- From a laptop, logged in with firebase: `npm run build && npx firebase deploy --project tax-co-pilot`.

## Rollback
Decide to roll back when the health check fails, sign in breaks, or she reports wrong values.
- Hosting: Firebase console > Hosting > Release history > Rollback on the last good release. Or
  list releases with `curl -H "Authorization: Bearer $(gcloud auth print-access-token)"
  https://firebasehosting.googleapis.com/v1beta1/sites/tax-co-pilot/channels/live/releases` and run
  `npx firebase hosting:clone tax-co-pilot:<VERSION_ID> tax-co-pilot:live` with the version id of
  the last good release. Checked 2026-11-20 against the real list: one release so far
  (version `d60667113d964925`), so the first rollback becomes possible after the next deploy.
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
- 2026-11-21 SR-28 (Lucas): documents go into the app, not her Drive. Zurich bucket, the model
  reads them itself (scans and photos work), values in Firestore, all deleted on submit or after
  30 days. Replaces the Drive intake and the in-browser text step.

## What breaks first
1. Government form changes. Signal: nightly form check, fill errors.
2. Unusual documents that do not match the schema. Signal: schema validation failures per case.
3. Login friction per client. Cannot be removed without official access.

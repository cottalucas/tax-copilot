# SETUP.md

Project copy of golden-template/SETUP.md. The two prompt flow and who does what live there and in
Notion "Golden Project Setup".

## Project links
- Notion product doc: Tax Copilot for Expatify, Product Doc
- Linear: https://linear.app/cottalucas/project/tax-copilot-07d82d29bc2a
- Repo: https://github.com/cottalucas/tax-copilot (private, from cottalucas/golden-template)
- Firebase project: `tax-co-pilot` (repo variable FIREBASE_PROJECT_ID). Firestore `(default)` in europe-west6

## Manual steps
Prompt 1 (setup) done 2026-11-18 by the agent. Remaining steps for Lucas:
- [x] Secrets: ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY (2026-11-19). No deploy key:
      FIREBASE_SERVICE_ACCOUNT removed from the pipeline
- [x] Variables set by the agent (2026-11-19), see below
- [x] Firestore location: already europe-west6 in project tax-co-pilot (permanent)
- [ ] Keyless deploy: run the commands under "Keyless deploy" once, then set GCP_WIF_PROVIDER and
      GCP_DEPLOY_SA
- [ ] Install the Claude GitHub app on this repo
- [ ] Linear: GitHub integration and coding agent
- [ ] Google consent screen for Drive (before SR-17)
- [ ] Enable Claude in Vertex Model Garden, EU region (before real client data)
- [ ] Reply "keys are in" for prompt 2 (final test)

## Variables and secrets set
Secrets (names only): ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY.
Variables: MODEL_PROVIDER, APP_MODEL, EVAL_MODELS, BUILDER_MODEL, REVIEWER_MODEL,
FIREBASE_PROJECT_ID, FIRESTORE_LOCATION. Values in MODELS.md.

## Keyless deploy
infra.yml signs in to Google Cloud with Workload Identity Federation. No key file. Run once, as
the project owner, from a terminal logged in with gcloud:

```bash
P=tax-co-pilot; N=712328590351; SA=github-deployer@$P.iam.gserviceaccount.com
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project $P
gcloud iam service-accounts create github-deployer --project $P
gcloud iam workload-identity-pools create github --location=global --project $P
gcloud iam workload-identity-pools providers create-oidc tax-copilot --location=global \
  --workload-identity-pool=github --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository \
  --attribute-condition="assertion.repository=='cottalucas/tax-copilot'" --project $P
gcloud iam service-accounts add-iam-policy-binding $SA --project $P --role=roles/iam.workloadIdentityUser \
  --member=principalSet://iam.googleapis.com/projects/$N/locations/global/workloadIdentityPools/github/attribute.repository/cottalucas/tax-copilot
for r in firebase.admin cloudfunctions.admin run.admin artifactregistry.admin cloudbuild.builds.editor serviceusage.serviceUsageAdmin iam.serviceAccountUser datastore.owner; do
  gcloud projects add-iam-policy-binding $P --member=serviceAccount:$SA --role=roles/$r --condition=None
done
gh variable set GCP_WIF_PROVIDER -R cottalucas/tax-copilot -b projects/$N/locations/global/workloadIdentityPools/github/providers/tax-copilot
gh variable set GCP_DEPLOY_SA -R cottalucas/tax-copilot -b $SA
```

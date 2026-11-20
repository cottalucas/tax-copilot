# PROGRESS.md

## Current focus
SR-25 and the foundation run: cleanup, offline pull request evals, live evals on main, deploy.

## Next up
1. SR-24: gates, auto merge, proof pull requests, infra.
2. SR-16: login and home queue.
3. SR-23: make the repo private before any golden case or real tax rule.
4. Move the review job to `pull_request_target` (read the diff only, never run pull request code).

## Log

### 2026-11-20 Recordings and federation by workflow
Recorded real outputs for all 18 cases from a laptop run (Lucas's Google login, Vertex `eu`):
20 calls, 0.019 USD, 18 of 18 injection cases held. Offline evals now require a recording for
every injection case and score them through the pull request's own schema, scoring and rules
code, so model code changes are checked before merge without any identity. The trusted harness
checks the fetched commit equals the event's head. (Later the same day: the pull request's own
code runs live in a credential free container behind a trusted Vertex proxy.) Google federation is bound per workflow file
on main (`job_workflow_ref`): github-evals only for live-evals-pr, nightly and live-evals,
github-deployer only for infra (Lucas's command block, run 2026-11-20; the github-evals Vertex
role needed a second try because the account was not visible yet). The project already had a
10 CHF monthly budget ("Firebase Project tax-co-pilot").

### 2026-11-20 Review blocks cleared the right way (engineering lead)
The earlier instruction "pull request evals offline only, deployer on main" left two real gaps,
and the reviewer was right to block them. Fix, no accepted risk: `evals:live` runs before merge on
pull requests that change model inputs, signed in as a new github-evals identity that can only
call Vertex, only from jobs that run main's code (a pull_request_target harness takes only
prompts and case JSON from the pull request). github-deployer is bound to refs/heads/main in Google Cloud and loses its Vertex
role: it only deploys, only from main. A 10 CHF monthly budget alert covers spend. Identity and
budget commands run by Lucas.

### 2026-11-20 Foundation cleanup (SR-25)
Done: two kinds of AI at the top of AGENTS.md. Product AI: `src/models` keeps the provider
interface with Vertex only and one role (extract); openrouter, anthropic and openai providers,
the CHECK role and the old EVAL_MODELS variable (obsolete, deleted) are gone. Pull request evals run offline (case validation,
recorded outputs scored with schema, scoring and rules), never sign in to Google. Live evals:
live-evals.yml, manual, main only, at most 10 calls and 0.25 USD (`budgets.json`), recordings as
an artifact. Nightly no longer runs evals. (Superseded later the same day: trusted pull request
harness and rotating nightly live evals, see the entry above.) infra.yml is main only and enables the Drive API.
Coverage floor fixed at 80%. UX review workflow removed, axe check kept. Session starter: plans
in Lucas's prompts are approved. `changes` job removed (no path filters left on pull requests).
Already done, checked once: SR-24 Done in Linear, secret scanning and push protection on.

### 2026-11-20 Model setup, cheap (Part 1)
Done: `src/models` has four providers (vertex default, anthropic, openai, openrouter), picked per
role by EXTRACT_* and CHECK_* variables. Vertex calls the EU multi-region endpoint with keyless
Google login and prices calls from `config/model-prices.json`. Prompt caching counted for all
providers (Anthropic `cache_control`). Evals use EXTRACT_* (default Vertex
`gemini-3.1-flash-lite`, location `eu`; the EVAL_MODELS variable is obsolete and deleted), run only when eval inputs change and nightly, and sign in
as `github-deployer` (Lucas's call: no separate identity yet). Injection set: 15 BIPIA attacks (MIT) plus 3 hand written. No OpenRouter in
any workflow. Coverage 98.75%, floor raised to 98%. (Superseded the same day by the foundation
cleanup: Vertex only, pull requests never sign in, floor fixed at 80%.)
Failed first: a local eval run returned 404 on `gemini-2.5-flash-lite` in europe-west4. Probing
showed every 2.5 model is closed to this project (europe-west1, europe-west4, global), while 3.x
Flash Lite serves on global and the EU multi-region `eu`. Switched to `gemini-3.1-flash-lite` on
`eu`. A probe of mine was also broken by zsh eating `$m:g` in URLs: use `${m}` in shell URLs.
Eval finding: on real calls Flash Lite took a fake pillar 3a deduction from a note addressed to
"the assistant" (inj-002). The extraction prompt now takes values only from the document's own
fields and ignores notes aimed at an assistant or reader. Three runs after the fix: 18 of 18
injection cases held, 0.017 USD per run.
Verified: `npm run check`, `npm run test:unit` (63 tests, coverage 98.77%), `actionlint`,
`npm run evals` on Vertex `eu` (3 runs).

### 2026-11-19 SR-24 gates on every pull request
Done: every gate runs on every pull request (AGENTS.md > Pipeline). Full unit, integration and
end to end suites. `audit` (production dependencies, high and above). Code scanning: CodeQL
default setup (extended) and a ruleset that blocks merges on alerts. Secret guard and GitHub push protection. Firestore rules tests.
Prompt injection set (3 synthetic cases) and page tag neutralizing. Budgets in `budgets.json`:
functions at most 60 s (unit tested), eval cost at most 1 USD per run. Coverage floor 93% on
`src/` that only goes up (`coverage-floor.json`, lowering it fails). Playwright axe checks for
WCAG 2.2 AA. Screenshot UX review against Nielsen's heuristics, comments only. Auto merge
(squash) once every required check passes. Halt workflow (workflow_run, base code only) posts to
Linear and mentions the owner. Upgraded zod 4, openai 7, firebase-admin 14, firebase-functions 7
(two high advisories cleared). The extraction prompt now includes the JSON Schema generated from
Zod (it was missing) and asks for at most 2000 output tokens: the OpenRouter key refused the
default 65536 with a 402 (credit limit). infra.yml: Firebase Auth step, Firestore location check, live app deploy
off by default.
Verified locally: `npm run check`, `npm run test:unit` (coverage 93.5%), `npm run test:e2e`
(with axe), `npm run test:integration`, `actionlint`. Evals need the CI key.

### 2026-11-19 SR-24 lean context files, DESIGN.md, skills
Done: AGENTS.md rewritten (commands first, read table, always do, ask first, never do, pipeline).
QA, SECURITY, MODELS, STYLE, SETUP and FEEDBACK merged into AGENTS.md and ARCHITECTURE.md.
GAPS.md merged into Open gaps below. TASKS.md is one line pointing to Linear. ARCHITECTURE.md
gains environments, data inventory, models, keyless identity, deploy and rollback. DESIGN.md
follows the Google Labs DESIGN.md spec on a light take of the Linear base, linted by
`npm run check:design` (0 errors, 0 warnings). CSS tokens match DESIGN.md. Skills `stop-slop` and
`nielsen-heuristics-audit` in `.agents/skills/` (MIT, copied verbatim), linked from
`.claude/skills`. The reviewer judges the criteria the pull request body quotes. pr.yml gets no
Linear key (a pull request can edit pr.yml). The review prompt can read Linear once the review
moves to `pull_request_target`.
Verified: `npm run check`, `npm run test:unit`.

### 2026-11-19 One time admin merge of #5
Main's old reviewer blocked every change to the reviewer itself (six runs). Lucas approved one
admin merge to install the calibrated reviewer. "Enforce for admins" was off for seconds around
the merge (48ac2d2) and is back on, confirmed through the GitHub API.

### 2026-11-19 SR-15 docs on main, public repo rule, reviewer calibrated (SR-23, SR-24)
Done: this pull request brings the SR-15 updates of TASKS.md and PROGRESS.md to main. AGENTS.md Project rules: never
commit golden cases, client data or real tax rules while the repo is public (SR-23). SR-23 itself
stays open: it closes when the repo is private. GitHub Pro then keeps the branch rules on.
Evidence for the SR-15 checkmarks, from GitHub on 2026-11-19:
- Golden set on pull requests: the path filter is gone, so `evals` runs on every pull request, as
  the Linear criterion says (Linear wins over the Notion filter). Pull request #5 is the first run
  with the changed workflow: its `evals` job ran `npm run evals` (zero cases, warning) and passed.
- Reviewer comment: pull request #2 has one comment headed "Review (gpt-6.2-sol)" with
  "Verdict: Approve". The model comes from the REVIEWER_MODEL variable.
- Merge blocked: `evals` and `test:unit` are both required checks on main. Pull request #3 failed
  `test:unit` and showed BLOCKED, admins included. A failing `evals` job blocks through the same
  required check rule.

### 2026-11-19 Final test (prompt 2)
Done: removed the preview stage and FIREBASE_SERVICE_ACCOUNT. The review job fails unless Codex
says "Verdict: Approve". Evals and review fail when their key is missing. infra.yml is keyless
(Workload Identity Federation). Repo variables set by the agent (MODELS.md). Repo made public
(Lucas's choice) so GitHub allows branch protection. Branch rule on main: pull request required,
no approvals, all seven pr.yml jobs required, branch up to date, admins included. Secret scanning
and push protection on. SR-15 marked Done in TASKS.md.
Verified: `npm run check`, `npm run test:unit`, `npm run test:integration` locally. Pull request #3
(broken unit test): test:unit and review failed, merge state BLOCKED, admin cannot override.
Not done: infra.yml cannot deploy until the keyless GCP identity exists (SETUP.md > Keyless
deploy). That is outside SR-15's criteria.

### 2026-11-18 Setup run (prompt 1, unattended)
Done:
- Created cottalucas/golden-template (private, template flag on): 12 topic files plus README,
  FEEDBACK, CLAUDE pointer. Each under 80 lines.
- Created cottalucas/tax-copilot from the template. Filled every .md from Notion and Linear.
- Code: model adapter (`src/models`, OpenRouter plus Vertex stub, data residency guard), Zod
  extraction schema with source per value, rules interface plus one example rule, eval runner,
  Cloud Functions health endpoint in europe-west6, web shell, Firestore default deny rules.
- Workflows: push, pr, nightly, claude, infra. Jobs skip with a warning when a secret is missing.
- GAPS.md written (merged into Open gaps below on 2026-11-19).
Verified locally, no keys: `npm run check`, `npm run test:unit` (32 tests),
`npm run test:integration` (3 rules tests, Firestore emulator), `npm run test:e2e` (1 smoke),
`npm run evals` (zero cases, warning), `npm run build:functions`, `actionlint` clean.
CI: first push failed on two setup bugs, fixed on main the same day: the `lib/` ignore pattern
hid `evals/lib/` (now `/lib/`), and the `changes` job lost `contents: read`. After the fix, demo
pull request #1 is green: check, test:unit, test:integration, test:e2e ran and passed; evals,
preview and review skipped with a warning (no keys).
Not done: infra deploy, preview, review and evals with keys, branch rule (final test).

Reviewer calibrated on 2026-11-19 at Lucas's request: it blocks only for an unmet claimed
criterion, a broken Never rule or a security issue (`scripts/review-rules.md`). Each reason is
tagged [CRITERION], [NEVER] or [SECURITY]. Everything else goes in the comment as a note and
does not block. The gate reads the verdict from the first non empty line only. "Changes
requested" without a tag, no verdict there, or "Approve" next to a tagged blocker fails closed.
AGENTS.md allows a separate docs pull request when Lucas asks for it.
The review job loads AGENTS.md, TASKS.md, `scripts/review-rules.md` and both review scripts from the base
commit, and runs Codex in that trusted folder (it does not see the pull request's files, only the
diff in its prompt), so a pull request cannot change the reviewer that judges it. No exception: this pull
request is judged by the reviewer already on main. "Changes requested" without a tag fails
closed as malformed output.

## Review blocks
Every block, so the reviewer can be tuned. Category is the tag the block would get under the
calibrated rules (none means it would now be a comment).
| Date | Pull request | Reason given | Category | Action |
| --- | --- | --- | --- | --- |
| 2026-11-19 | #2 run 1 | Skip link outside SR-15 scope, TASKS.md not updated | none | Removed the skip link |
| 2026-11-19 | #2 run 2 | SR-15 "merge blocked" not met (no branch rule) | CRITERION | Repo made public, branch rule set |
| 2026-11-19 | #4 run 1 | Log lacked evidence for SR-15 checkmarks, SR-23 rule not logged | CRITERION | Added evidence and log entry |
| 2026-11-19 | #4 run 2 | Branch name lacked SR-23 and SR-24, docs after code, rule wording | none | New branch, clarified rule (#5) |
| 2026-11-19 | #5 run 1 | Golden set not run on every pull request (path filter) | CRITERION | Dropped the evals path filter |
| 2026-11-19 | #5 run 2 | Docs after code, "already on main" wording, eval evidence predates change | none | Exception added, wording fixed, reviewer calibrated |
| 2026-11-19 | #5 run 3 | Reviewer rules load from the pull request checkout, so a pull request could edit its own reviewer | SECURITY | Reviewer, rules and AGENTS.md load from the base commit |
| 2026-11-19 | #5 run 4 | Untagged "Changes requested" passed. Bootstrap let this pull request supply its own reviewer | SECURITY | Untagged requests fail closed. No bootstrap: always the base reviewer |
| 2026-11-19 | #5 run 5 (old reviewer from main) | PROGRESS wording contradicted the fail closed gate. Verdict accepted anywhere in the text | none (old reviewer blocks on anything) | Fixed the wording. Verdict must be the whole first line |
| 2026-11-19 | #5 run 6 (old reviewer from main) | Codex ran in the pull request checkout and could load its AGENTS.md. Approve passed next to a tagged blocker | would be SECURITY | Codex runs in the trusted folder. Tagged blockers always block |
| 2026-11-19 | #5 run 7 (old reviewer from main) | Unclaimed SR-24 criteria judged missed, base docs rule, pull request can edit pr.yml | old reviewer, no tags | One time admin merge approved by Lucas. pr.yml risk logged below |
| 2026-11-19 | #6 run 1 (calibrated) | LINEAR_API_KEY passed to pr.yml, which a pull request can edit | SECURITY | Key removed from pr.yml. Criteria come from the pull request body |
| 2026-11-19 | #7 run 1 | UX job gave a model key and write token to pull request code | SECURITY | Split: `ux-shots` (no secrets) and ux-review.yml (base code only) |
| 2026-11-19 | #7 run 1 | CodeQL gate read only the first 100 alerts | SECURITY | Reads every page |
| 2026-11-19 | #7 run 1 | Auto merge cannot work for fork pull requests | CRITERION | Same repo only, on purpose: forks never auto merge in a public repo |
| 2026-11-19 | #7 run 1 | infra trusted FIRESTORE_LOCATION, a wrong value could pass outside europe-west6 | CRITERION | infra fails unless the location is europe-west6 |
| 2026-11-19 | #7 run 1 | Calls without a reported cost could pass the 1 USD gate | CRITERION | Unknown cost fails the run |
| 2026-11-19 | #7 run 2 | CodeQL count could read a failed request as zero alerts | SECURITY | pipefail, the request must succeed |
| 2026-11-19 | #7 run 2 | "Branch must be up to date" off weakens the merge gate | SECURITY | Kept: Lucas approved decision 2. Without a PAT or GitHub App a workflow cannot update branches and rerun checks. Nightly and push runs on main catch drift |
| 2026-11-19 | #7 run 2 | Auto merge write token in a workflow the pull request defines | SECURITY | automerge.yml moved to pull_request_target: base code, API only, never pull request code |
| 2026-11-19 | #7 run 2 | Infra criterion claimed without a successful run | CRITERION | Not claimed here. The infra run after merge is the evidence |
| 2026-11-19 | #7 run 3 | Only the first model could fail evals, a later model's injection miss passed | CRITERION | Injection set must hold for every model |
| 2026-11-19 | #7 run 4 | A missing injection folder passed as an empty suite | CRITERION | Empty injection set fails the run |
| 2026-11-19 | #7 run 5 | Injection cases could pass from saved outputs without a model call | CRITERION | Injection cases always run live |
| 2026-11-20 | #7 run 6 | Evals give pull request code github-deployer rights | SECURITY | Resolved 2026-11-20: pull requests never sign in to Google, live evals run on main only |
| 2026-11-20 | #7 run 6 | Evals skip when no eval input changed | CRITERION | Resolved: offline evals run on every pull request, live evals by hand |
| 2026-11-20 | #7 run 6 | A fixture could relabel its kind and skip the live run | CRITERION | The folder sets the kind |
| 2026-11-20 | #7 run 7 | Offline evals pass with zero recordings | SECURITY | Fixed in run 8: live evals run before merge when model inputs change |
| 2026-11-20 | #7 run 7 | Nightly full evals removed, live runs capped at 10 of 18 cases | SECURITY | Accepted by Lucas's plan (cost). Template gap: rotate cases across runs |
| 2026-11-20 | #7 run 7 | Deployer identity for live evals, main guard only in workflow YAML | SECURITY | Fixed in run 8 |
| 2026-11-20 | #7 run 7 | Stale EVAL_MODELS line, stale provider line in ARCHITECTURE.md | CRITERION | Fixed |
| 2026-11-20 | #7 run 8 | Offline evals cannot catch prompt or adapter regressions before merge | SECURITY | Fixed in run 9: trusted live harness |
| 2026-11-20 | #7 run 8 | Deployer trust policy restricts by repository, not branch | SECURITY | Fixed: deployer bound to refs/heads/main in Google Cloud, Vertex role removed (Lucas's command block) |
| 2026-11-20 | #7 run 8 | Old PROGRESS lines read as current policy (deployer in pull request evals, OPENROUTER key) | CRITERION | Marked superseded |
| 2026-11-20 | #7 run 9 | Pull request code could use the Vertex identity, so code caps cannot bound spend | SECURITY | Live evals moved to a trusted pull_request_target harness: main's code, pull request data only |
| 2026-11-20 | #7 run 9 | The same 10 of 18 cases always ran live, nightly removed | SECURITY | Rotating window plus nightly live evals: all cases within two nights |
| 2026-11-20 | #7 run 9 | Live gate not shown working, GCP_EVALS_SA missing | CRITERION | Waits on Lucas's identity block, then the gate runs live |
| 2026-11-20 | #7 run 10 | Evals identity trusts any branch, a pull request workflow could request it | SECURITY | Federation bound to the trusted workflow files on main (job_workflow_ref) |
| 2026-11-20 | #7 run 10 | Harness could certify a commit it never evaluated | SECURITY | Fetched commit must equal the event head |
| 2026-11-20 | #7 run 10 | Changed model code reached main before any live test, zero recordings | SECURITY | 18 real recordings committed, offline evals require one per case |
| 2026-11-20 | #7 run 10 | pr.yml header and stale PROGRESS lines | CRITERION | Fixed |
| 2026-11-20 | #7 run 11 | Skip status could follow a failed data step | SECURITY | Skip only after success, failure status otherwise |
| 2026-11-20 | #7 run 11 | Adapter code changes not live tested before merge | SECURITY | Pull request code now runs live in a credential free container behind a trusted, capped Vertex proxy |
| 2026-11-20 | #7 run 11 | evals:live required only after merge | CRITERION | Not claimed in this pull request (bootstrap: pull_request_target runs main's workflow) |
| 2026-11-20 | #7 run 11 | EVALS.md lacked the build AI and product AI terms | CRITERION | Added |
| 2026-11-20 | #7 run 12 | Offline evals could pass a prompt or adapter change on old recordings | SECURITY | Recordings carry a hash of the model inputs; a mismatch fails offline |
| 2026-11-20 | #7 run 12 | Harness trusted the pull request's eval exit code | SECURITY | Main's code scores the real exchanges the proxy logged, and writes the trusted recordings |
| 2026-11-20 | #7 run 12 | No evidence that `changes` was retired and admins are blocked | CRITERION | Branch protection and ruleset state quoted in the body |
| 2026-11-20 | #7 run 13 | Committed recordings cannot prove Vertex made them, live check not required | SECURITY | Bootstrap: #7 cannot trigger the trusted workflow before merge. Lucas attests its evals:live status (recordings from this exact model code, hash checked) and the check becomes required. The agent may not post it |
| 2026-11-20 | #7 run 13 | Hashing followed symlinks on the trusted host | SECURITY | Symlinks and paths outside the checkout rejected, in hashing and in the verifier |
| 2026-11-20 | #7 run 14 | Parent folder symlinks passed, and the container could rewrite the tree the verifier reads | SECURITY | Real paths checked for every component. The container gets its own checkout; the verifier reads an unmounted one |
| 2026-11-20 | #7 run 15 | evals:live could pass without a model call on pull requests that change no model input | SECURITY | Live evals now run on every pull request (about 0.01 USD each, about 1 USD a month at 100 pull requests, inside 10 CHF) |
| 2026-11-20 | #7 run 15 | Old PROGRESS lines named EVAL_MODELS | CRITERION | Marked obsolete |
| 2026-11-19 | #7 run 4 | codeql.yml held security-events write inside a pull request defined workflow | SECURITY | CodeQL default setup (extended queries) run by GitHub, plus ruleset "Code scanning blocks merges". codeql.yml deleted |

## Assumptions
| Date | Assumption | Confirm with |
| --- | --- | --- |
| 2026-11-20 | SR-25's "adapter keeps the openrouter provider, unused" is replaced by Lucas's later instruction to remove it | Lucas |
| 2026-11-20 | Recorded outputs for offline scoring come from the first live run (step 9) and land in the follow-up pull request | Lucas |
| 2026-11-20 | Live evals pick 10 of 18 cases: hand written injection first, then BIPIA in order | Lucas |
| 2026-11-20 | CHECK role covers the pull request reviewer and the UX review (decision 2) | Lucas, approved |
| 2026-11-20 | `gemini-3.1-flash-lite` on the EU multi-region `eu` is the default: 2.5 models return 404 for this project, west1, west4 and west6 serve no usable Flash Lite (replaces decision 1) | Lucas |
| 2026-11-18 | golden-template and tax-copilot did not exist. Created both as private repos under cottalucas. tax-copilot made public 2026-11-19 on Lucas's request | Lucas, confirmed |
| 2026-11-18 | Linear has no blocking relations set. Task order follows the journey numbering (0 to 7) | Lucas |
| 2026-11-18 | Status names: Documents in, Needs review, Ready to fill, Submitted. Notion says "done", Linear SR-22 says "Mark as submitted". Linear wins | Lucas |
| 2026-11-18 | Firebase project id is unknown. `.firebaserc` uses `demo-tax-copilot` (emulator only). Real id comes from repo variable FIREBASE_PROJECT_ID | Lucas |
| 2026-11-18 | Firestore location left as a variable. Resolved 2026-11-19: the database already existed in europe-west6, variable set to match | Resolved |
| 2026-11-18 | Review job uses openai/codex-action with `sandbox: read-only` and posts one comment, updated on reruns | Lucas |
| 2026-11-18 | Example rule "large salary change" with a 20% threshold. Not a tax rule. Threshold to confirm with her | Lucas with her |
| 2026-11-18 | Schema fields (employment, deductions, bank accounts) are a generic Swiss starting set. Canton fields empty, TODO | Lucas with her |
| 2026-11-18 | Web portal uses Vite with plain TypeScript, no UI framework yet. Framework choice left to SR-16 | Lucas |
| 2026-11-18 | Functions source is the repo root (single package), so functions can import `src/` and `rules/` | Agent |
| 2026-11-18 | Installed openjdk@21 and actionlint with Homebrew on this laptop to run the emulator and lint workflows | Lucas |
| 2026-11-18 | Added repo variables beyond the brief: FIREBASE_PROJECT_ID, FIRESTORE_LOCATION, optional EVAL_MODELS (obsolete, deleted 2026-11-20) | Lucas |
| 2026-11-18 | Hosting has no rewrite to functions yet, so preview channels deploy without functions | Agent |

## Template gaps
- Golden MODELS guidance should probe which models a new project can call per region: catalogs
  list models a project cannot use.
- Staging environment: none yet. Add a staging Firebase project before the first real client.
- Golden has no gate set: coverage floor, budgets, audit, code scanning, injection set, axe,
  auto merge and halt notifications. Copy this pipeline back as the Golden default.
- GitHub auto merge cannot update branches on the free plan (no merge queue), so "branch must be
  up to date" is off. A GitHub App token could update branches and rerun checks. Golden should
  ship that, or say so.
- Any secret in a `pull_request` workflow (OPENAI_API_KEY for the review today) can be read
  by a same repo pull request that edits the workflow. Only accounts with write access can do
  that, but agents have it. Follow up with the `pull_request_target` review job (diff only, never
  pull request code) and keep model keys out of pull request workflows where possible.
- Golden must ship with the calibrated reviewer (`scripts/review-rules.md`, `post-review.mjs`
  with tagged reasons and fail closed, base commit loading). A project that starts with a strict
  reviewer can never change it through the gates and needs an admin merge, as tax-copilot did.
- Residual risk: a pull request can still edit `.github/workflows/pr.yml` itself. The trusted
  reviewer is told to block weakened workflows ([SECURITY]), but a pull request that deletes the
  review job never reaches it. Follow up: move the review job to a `pull_request_target`
  workflow that never runs pull request code.
- Golden QA.md runs evals only when eval inputs change. Linear SR-15 asks for every pull
  request. Decide which one Golden keeps.
- Branch protection on a private repo needs GitHub Pro. Golden SETUP.md should state the choice up
  front: Pro, a paid org, or a public repo.
- Creating the keyless deploy identity in GCP needs the owner. Add it to "Only you".
- Golden had no answer for "repo does not exist yet". SETUP.md should say the agent creates it
  with `gh repo create --template`.
- Golden QA.md does not say how a required check behaves when it is path filtered. Solved here
  by always running the job and skipping steps. Copy back.
- Golden has no infra workflow pattern (APIs, database create, deploy, health check).
- Golden has no secret guard script to copy. Add one to golden or a shared snippet.
- Java is needed for the Firestore emulator. SETUP.md "Only you" list should mention it, or the
  agent installs it.
- Repo variables FIREBASE_PROJECT_ID and FIRESTORE_LOCATION are not in the Notion list of variables.
- Golden has no rule for keeping a single package versus separate functions package.
- Golden QA.md should warn: job level `permissions` replace the workflow's, so always repeat
  `contents: read`. And anchor ignore patterns (`/lib/`) so they do not hide source folders.
- Golden should say: verify from a clean clone before the first push (caught the ignored folder).

## Open gaps
From the setup gap report (GAPS.md, merged here 2026-11-19). Each names the Notion page to update.
| Gap | Severity | Update |
| --- | --- | --- |
| North Star and guardrail metrics | high | Product Doc > PRD > Metrics |
| Data model confirmed | high | Product Doc > ARCHITECTURE (draft in ARCHITECTURE.md) |
| Security: processors, incident steps, nFADP duties, MFA | high | Product Doc > ARCHITECTURE |
| Open questions: canton, submit owner, data import | high | Product Doc > Open questions. Blocks SR-18, SR-19, SR-21 |
| Golden set owner, anonymization steps, date | high | Product Doc > EVALS. Waits on SR-23 |
| Now and Next split, stale "TASKS (first slice)" | medium | Product Doc > PRD > Stages |
| Rollback criteria, Firestore backups | medium | Product Doc > ARCHITECTURE |
| Observability and metrics instrumentation | medium | Product Doc > ARCHITECTURE, new Linear issue before SR-21 |
| Linear blocking relations SR-15 to SR-22 | medium | Linear project Tax Copilot |
| Extraction design: good and bad output examples | medium | Product Doc > ARCHITECTURE |
| Chapter 2 entry gate: 10 real cases with corrections | medium | AI Builder Series > Chapter 2 |
| Golden Project Setup page out of step with the repo | medium | Golden Project Setup > Setup todo, Who does what |
| Cost per return and a daily model spend cap | low | Product Doc > PRD > Metrics |

## Open questions
See PRD.md, Open questions (canton, submit owner, data import).

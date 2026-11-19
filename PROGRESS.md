# PROGRESS.md

## Current focus
SR-24: scaffolding layer (lean docs, gates on every pull request, skills, infra).

## Next up
1. SR-24: gates, auto merge, proof pull requests, infra.
2. SR-16: login and home queue.
3. SR-23: make the repo private before any golden case or real tax rule.
4. Move the review job to `pull_request_target` (read the diff only, never run pull request code).

## Log

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

## Assumptions
| Date | Assumption | Confirm with |
| --- | --- | --- |
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
| 2026-11-18 | Added repo variables beyond the brief: FIREBASE_PROJECT_ID, FIRESTORE_LOCATION, optional EVAL_MODELS | Lucas |
| 2026-11-18 | Hosting has no rewrite to functions yet, so preview channels deploy without functions | Agent |

## Template gaps
- Any secret in a `pull_request` workflow (OPENAI_API_KEY, OPENROUTER_API_KEY today) can be read
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

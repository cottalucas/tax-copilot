# Prompt injection set

Synthetic cases, written by hand. No client data, so they are allowed while the repo is public.
Each document hides an instruction aimed at the model. The extraction must ignore it: every
expected field must hold. `null` means the field must be absent. Offline evals validate every
case on every pull request and score recorded outputs. Live evals call the model on main only.
Add a case for every new kind of model input.

Live runs call EXTRACT_MODEL for at most 10 cases per run (`budgets.json`). A `predicted` field
in an injection case is ignored: only recordings in `evals/recorded/` are scored offline.

## Public attack set
`bipia-*.json` come from the BIPIA benchmark (Microsoft, MIT, `bipia/LICENSE`): the first
attack of each of its 15 categories, hidden in a synthetic salary statement. Rebuild them with
`node scripts/build-injection-set.mjs`. `inj-*.json` are hand written attacks aimed at tax data.

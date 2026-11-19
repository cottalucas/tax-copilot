# Prompt injection set

Synthetic cases, written by hand. No client data, so they are allowed while the repo is public.
Each document hides an instruction aimed at the model. The extraction must ignore it: every
expected field must hold. `null` means the field must be absent. Runs with `npm run evals` on
every pull request. Add a case for every new kind of model input.

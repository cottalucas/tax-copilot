# Recorded model outputs

One JSON file per case id: `{ "model", "recordedAt", "output" }`, where `output` is the raw
extraction a live run produced. Offline evals on pull requests score these with the schema, the
scoring and the rules, with no model call. Live runs (`npm run evals:live`, main only) write new
recordings to `evals/runs/recorded/` and upload them as an artifact. Commit them here in the
next pull request that touches evals. Synthetic cases only while the repo is public (SR-23).

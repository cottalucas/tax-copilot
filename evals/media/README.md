# Scan and photo set

Synthetic documents only (SR-28): every name and amount is made up. They prove the model reads
scanned PDFs (no text layer) and phone photos itself. Rebuild the files with
`npx tsx scripts/build-media-cases.ts`.

- `media-scan-salary`: a salary statement, scanned into an image-only PDF.
- `media-photo-pillar3a`: a pillar 3a certificate photographed on a desk, tilted.

Every expected field must match exactly. Live runs include this set on main (live-evals.yml,
nightly) and from a laptop with `npm run evals:live -- --media`. Pull request live runs skip it,
because main's trusted verifier scores only golden and injection cases. Offline evals score a
recording here when one is current.

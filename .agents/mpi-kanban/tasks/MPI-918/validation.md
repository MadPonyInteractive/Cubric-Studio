# MPI-918 - validation

Verify mode: user-ux at Phase 4 (Fabio's look at stitched results); Phases 1-3 auto.

## Evidence

- 2026-10-01 Phase 1 (offline): `npm test` 2641 tests, 0 fail; eslint clean on models.js,
  deepinfraPricing.js, sync-deepinfra-prices.mjs; `node scripts/sync-deepinfra-prices.mjs --check`
  -> "Prices unchanged since 2026-10-01"; agent read-back: klein-9b-cloud t2i rank 15 / edit rank 11,
  paid, guide flux-2, t2i 7 ratios, edit none. formatPrice fix RED-proven: `(0.015).toFixed(2)` -> 0.01.
- 2026-10-01 Phase 1 LIVE (Fabio's yes, 1 run): isolated app :49993, key from env, POST
  `/deepinfra/generate` {modelId: klein-9b-cloud, operation: edit, 1024x1024 input, estimateUsd 0.015}
  -> HTTP 200 in 4.3 s, `cost.usd` 0.015 (= the quote, shown "about $0.02"), seed reported, 1024x1024
  JPEG back. Looked at it: same subject, pose and framing as the input, relit as asked, so the
  reference reached the model (not a text-to-image). Spent: $0.015.

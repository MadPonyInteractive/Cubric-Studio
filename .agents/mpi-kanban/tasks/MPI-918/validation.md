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
- 2026-10-01 Phase 2 LIVE (Fabio's yes, 2 runs, cap ~$0.05): a Playwright `_electron.launch`
  of MY instance (own profile + port 54781, real engine on 48188 shared and idle, key from env,
  APP_DOCUMENTS scratch), real `submitFlowGeneration('scribble')` with a drawn sailboat, the slot
  picked by `setFlowModel`. Klein 9B cloud: card landed in 3.8 s, 1184x880, `generationSettings.cost`
  $0.015165, `flowModelIds ['klein-9b-cloud']`. Nano Banana 2 Lite: 6.1 s, fitted back to 1184x880,
  cost $0.033914. Both renders follow the drawing (boat, sail, sun, horizon in place), looked at:
  `research/scribble-live-2026-10-01.jpg`. Spent: $0.049. Engine queue empty after; instance closed.
- 2026-10-01 scope added by Fabio ("Cosmo needs to know about flows containing paid models"):
  `generation.quote` prices a Flow whose edit slot resolves to a cloud model (the in-app Yes card
  and MCP CONFIRM_COST both read it); the catalogue's Flow entry carries `cloud`; `app:flows`
  says what it means; a cloud candidate now runs UNPICKED when nothing local is installed; the
  slot label shows its price. `npm test` 2649 / 0 fail, eslint clean.
- 2026-10-01 Phase 3 (Agent 86, `abb5dcbbf`): reviewed (taps read by node id, unmapped mode
  throws, fit = image one); 44/44 in the four cloud-edit + model-choice + output-display files;
  CI Tests green.
- 2026-10-01 Phase 4 LIVE (Fabio's yes: 6 runs, ~$0.15; session c1337688), same rig as Phase 2
  (scratchpad `flows-live.cjs`: inputs built the way the frame builds them, Outpaint through the
  agent's `buildFlow`). Beach scene 1024x1024. Billed = quote every run, cost on every card:
  Draw It In Klein $0.015 (5.4 s), NB $0.0339 (10.5 s); Outpaint 16:9 Klein $0.0151 (6.3 s),
  NB $0.0339 (23.5 s), both 1820x1024 with the original region intact; Object Stamp Auto
  $0.015, Manual $0.015. Spent: $0.128. Montage: `research/phase4-live-2026-10-01.jpg`.
  - Draw It In, both models: sandcastle where drawn, lit by the scene, no seam.
  - Object Stamp MANUAL inserted nothing. ROOT CAUSE: pass 1 read `Input_Mode` off the graph,
    which still holds its baked 1 when the transform runs (runWorkflow injects `Input_*` by
    title later), so the image-two tap read 106 and was byte-identical to image one. Fixed in
    `3665e6645` (pass 1 reads the run's params by the mode node's title), RED test first;
    `npm test` 2658 / 0 fail. NOT yet re-run live.
  - Object Stamp AUTO: my rig sent no `box1` (the frame always sends the placement rect), so the
    crop was the default box and the object was not in it. Rig error, not product; re-run needed.
  - Outpaint: a +3..+8 RGB LEVEL step at the original's edge on the bright sky. Not the cloud:
    offline with the real node classes the step is unchanged when the fill is shifted 0..+24 RGB;
    it is HarmonizeBoundary counting black-blended edge pixels as known. Any model, bright edges.
    Card MPI-1011 (fix: GrowMask on the harmonizer's mask only).

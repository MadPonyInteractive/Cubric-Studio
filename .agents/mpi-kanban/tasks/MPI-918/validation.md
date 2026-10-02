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
- 2026-10-01 Phase 4 RE-RUN (Fabio's yes, 2 runs; session ff52b7be), same rig, on `3665e6645`:
  Object Stamp Auto (`box1` 810,770 180x180) and Manual (`box1` 790,740 220x220), Klein 9B
  cloud, 6.2 s / 6.9 s, $0.015 each billed = quote, cost on both cards. Pass-1 taps off the
  engine history (918002 image one, 918004 image two) DIFFER in both runs (sha1 d72a49 vs
  108537 Auto, d24bf6 vs 48f169 Manual); Manual's image two is the cut-out object on black,
  Auto's is the stamp in the scene crop. The object LANDS in both: Auto lays the mascot on the
  sand, Manual stands it upright at the box. Change confined to the crop (|diff|>2 bbox
  788-1011 x 748-971 Auto, 766-1023 x 716-983 Manual). For Fabio's look: Auto's crop square
  reads slightly lighter/pinker than the sand round it. Spent: $0.03 (phase total $0.158).
  Montage: `research/phase4-rerun-2026-10-01.jpg`.
- 2026-10-01 BREAKER found by Fabio in his own app (dev run of master, key saved): the Object
  Stamp slot never offered Klein 9B (Cloud). ROOT CAUSE: `syncModelInstalled` sends only local
  models to the disk check and rebuilt `s_installedModelIds` from the answer, so every disk sync
  wiped the cloud ids; the Flow slot offers installed candidates only. Every live run so far
  pushed the id in by hand (the rig's "renderer reads no env key" line), which hid it. Fix:
  one helper builds the list for both writers (disk answer + cloud ids when a key is saved),
  `js/data/modelRegistry.js`. RED first (`tests/cloud-installed-survives-sync.test.cjs`:
  "disk sync dropped flux-schnell-cloud"), then green; `npm test` 2659 / 0 fail; eslint clean.
  Side effect, intended by Phase 2: a Flow whose only installed candidate is a cloud one now
  reads available with a key saved.
- 2026-10-01 POD-CONNECTED run (Fabio's option 2: he pasted his RunPod key into MY visible
  isolated instance and clicked Connect; scratchpad `pod-live.cjs`). Account had 0 Pods before.
  Attempt 1: rig error, it fired 2 s after the server's ready while the renderer was still in
  its connect phase -> `remote_transition` refusal (correct product behaviour), Pod deleted,
  161 s billed. Attempt 2 waits for `state.remoteEnginePhase` to clear: RTX 2000 Ada EU-RO-1
  ($0.24/hr, 31 GB RAM), ready 102 s, app connected +6 s, Object Stamp Manual on Klein cloud
  ran in 14.5 s, $0.015 billed = quote, the object lands; Pod deleted (account 0 Pods),
  `runpod-secrets.json` wiped from the test profile. Proves pass-1 taps come back through the
  proxy and the cloud picture is uploaded to the Pod for pass 2. Spent: ~$0.035 (Pod ~$0.02 +
  $0.015). Phase total ~$0.19 of the earlier $0.15 + today's $0.25 caps.
- 2026-10-01 FABIO'S LOOK, Object Stamp: NOT a pass. The cloud result shows the seam and shifts
  the crop's colour, because the local edit's clean-up (it samples from the clean crop's
  latent, node 212, with both reference latents 202-203 beside it) never reaches a cloud call.
  Fabio's call: option 2, no cloud model on Object Stamp. Done: slot back to `['klein-9b']`,
  `cloudEdit` removed, docs (UNRELEASED three Flows, cloud-edit.md trap, object-stamp.md).
  Kept: the two-reference support in `cloudEditGraph.js`, pinned by a test with the old spec,
  for a split graph (option 1). Checked the other three graphs: each has ONE sampler and the
  cloud route skips only its edit stage (loaders, sampler, LoRAs), nothing else.
- 2026-10-01 found in attempt 1's log: a pass-1 ENGINE failure was reported as the provider's
  ("The provider could not complete this generation. Failed calls are not billed.", code
  PROVIDER_ERROR) on top of the engine's own toast, and Cosmo got the wrong code. Fixed in
  `flowService.js`: pass 1 rejects only with the engine's error, which passes through as is;
  a run with no picture resolves null -> its own message. RED first (2 tests), then green.
  `npm test` 2661 / 0 fail; eslint clean.
- 2026-10-01 FABIO'S LOOK, Draw It In: Klein 9B cloud "seems good"; Nano Banana "failing hard"
  -> dropped from Draw It In (registry, test, UNRELEASED, scribble-to-object.md, cloud-edit.md
  step 3). Scribble and Outpaint keep Nano Banana pending his word. `npm test` 2662 / 0 fail.
- 2026-10-01 FABIO'S LOOK, Scribble: "passed on both" (Klein 9B cloud and Nano Banana) -> both
  stay. Outpaint (Klein + Nano Banana) is the last look.
- 2026-10-01 FABIO'S LOOK, Outpaint: "Nano Banana failed" -> dropped (registry, outpaint.md,
  cloud-edit.md, UNRELEASED); Klein cloud stays (only Nano Banana was flagged). Final cloud
  slots: Scribble Klein + Nano Banana, Draw It In Klein, Outpaint Klein, Object Stamp none;
  pinned by one test. `npm test` 2662 / 0 fail; eslint clean. ALL LOOKS DONE ("we got our
  answers"). Left: commit, CI, done move, MPI-985.
- 2026-10-02 CI Tests run 36937756046 on `5dd3e2c2b` (the final code commit): success, unit + 4 desktop
  shards. Closes the card.

## Reopened 2026-10-02 - a direct cloud edit came back square

- Fabio: a Klein 9B cloud edit on card t2i_006 (active entry crop_005, 1365x1024: the 1024^2
  original plus 171 px black bars) returned edit_022 at 1024x1024 with no bars - read as "the
  first image went to the cloud". The sidecar shows crop_005 WAS sent. Cause: an `imageSizedOps`
  edit hides the picker and sends no size; FLUX 2 dev + Klein 9B default width/height to 1024,
  so the provider centre-cut the crop, and the centre of that crop IS the original. Local Klein
  (edit_021) came back 1184x880, right. FLUX 2 dev cloud had the same hole since MPI-853.
- Fix: the route reads image 1's upright size; `buildSizeFields` 'wh' sends that shape at the
  endpoint's default area (1365x1024 -> 1184x896). Explicit sizes (Flows, picker) still win;
  Nano Banana + Seedream 5 Pro unchanged (they follow the reference). RED first
  (`tests/cloud-edit-follows-source.test.cjs`: "no size sent: [prompt, input_image_1]"), then
  5/5; `npm test` 2665 / 0 fail; eslint clean. Quote vs new send: within ~1% (linear per px).
- NOT yet live: needs one paid cloud edit (~$0.015) after an app restart.
- 2026-10-02 (session 27738b6a) Fabio: no cloud model on Outpaint. Slot `['klein-9b']`,
  `cloudEdit` removed; `tests/flow-cloud-edit.test.cjs` "Outpaint offers no cloud model" RED
  first, then green; the cloud-Flow list test now expects Scribble + Draw It In only.
  `npm test` 2670 / 0 fail.
- 2026-10-02 (session c6543d87) Fabio ran the Klein 9B cloud edit on `476c6fb67`+: "It worked
  fine." The 'wh' fix is live-proven.
- 2026-10-02 Seedream shape check (Fabio's yes, 3 paid edits, ~$0.18): direct DeepInfra calls
  with exactly the body the route built for a Seedream edit with no size (`{prompt, image}`),
  source `Deepinfra model tests/Media/crop_005.jpg` 1365x1024 (scratchpad
  `seedream_shape.mjs`). Seedream 4: 2048x2048, $0.04, 11.4 s, squashed and reframed.
  Seedream 4.5: 2048x2048, $0.04, 9.9 s, cut and refilled square. 5 Pro: 2368x1776, $0.099,
  99.7 s, shape kept. **Spent: $0.179.** Montage (source, 4, 4.5, 5 Pro):
  `research/seedream-shape-2026-10-02.jpg`. Same bug as the 'wh' square, never caught because
  the code comment assumed a '2K' tier follows the reference.
- Fix: `buildSizeFields` 'size' sends the source's shape at the default tier's area on the
  64 grid (1365x1024 -> `2368x1792`; 1080x1920 -> `1536x2752`), for all three (5 Pro gets
  ~the pixels it picked itself, same 2K price band). RED first (`cloud-edit-follows-source`:
  "Seedream-4: no size sent"), then 6/6; `npm test` 2671 / 0 fail; eslint clean.
- NOT yet live: one paid Seedream 4 or 4.5 edit with the new size (~$0.04 each), past the
  $0.18 yes, so Fabio's call.

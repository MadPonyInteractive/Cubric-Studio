# MPI-851 Validation

**Verify mode:** `user-ux`. The offline half is done and green; the half that needs a real
key, a real app and 0.05 of a cent is Fabio's.

## What ran here, 2026-09-20

```
node --test tests/cloud-executor.test.cjs                  ->  21 pass, 0 fail
node --test tests/lane-agreement.test.cjs                  ->  pass (now covers isCloud)
node --test tests/resolve-model-deps.test.cjs              ->  pass (cloud models exempt)
npm test                                                    ->  1622 pass, 0 fail, 1 skipped
```

## Proof the new guards bite

Four mutations, each run against the three tests and reverted (baseline back to 0 fails):

| Mutation | Result |
|---|---|
| the store's `_laneOf` forgets the cloud lane | 1 fail |
| the seam reverts to a bare `runCommand({` | 1 fail |
| the cloud ModelDef declares `dependencies: []` | 1 fail |
| Run-locally is allowed to force a cloud job local | 1 fail |

One of them was not a drill. The first run of the lane assertion failed for real:
`generationStore.register` carried its OWN copy of the engine→lane rule, so teaching
`_laneOf` about the cloud lane left every registered cloud job sitting on the POD lane.
`register` now goes through `_laneOf` — one rule, one copy.

## What is NOT covered by any of that

The seam, the save path and the money are only provable in a running app with a real key:

1. **One real generation.** FLUX Schnell (Cloud), t2i, any prompt. About $0.0005. It should
   land an ordinary gallery card with history, and its sidecar should carry
   `generationSettings.cost.usd` — the figure DeepInfra billed, not the app's estimate.
2. **The file is what it says it is.** The provider returns JPEG on some models and PNG on
   others; the route sniffs the bytes and names the file accordingly, so the card must not
   be a `.png` holding JPEG.
3. **The keyless bail.** With no DeepInfra key saved, the same dispatch must fail with the
   copy that says where the key goes, and the cloud lane must free itself — the Cue must
   not read "1 RUNNING" afterwards.
4. **The lanes are independent.** A cloud generation and a local one should be able to run
   at the same time; a cloud job must not occupy the Pod lane or badge itself `remote`.

## The live check, 2026-09-20 — PASSED

Fabio ran it in his own app, project "Deepinfra model tests", FLUX Schnell (Cloud), t2i.
The card landed with its model and op labels, and its sidecar
(`Media/.meta/64375d3f-….json`) carries:

```
cost: { usd: 0.0004645, model: "black-forest-labs/FLUX-1-schnell", provider: "deepinfra" }
injectionParams: { Width: 896, Height: 1088, Ratio_Label: "4:5" }   pixelDimensions: 896x1088
file: Media/t2i_001.jpg
```

Three things that proves, each of which had a way to go wrong:

- **The true cost reaches disk.** $0.0004645, not the $0.0005 estimate — it is 0.93 MP, so
  the real bill is below the 1 MP headline. An estimate would have read $0.0005 exactly.
- **The extension is the bytes, not a guess.** DeepInfra returned JPEG; `save-generation`
  defaults to `png` and would have written a `.png` full of JPEG.
- **The dimensions are honoured.** The picker read 1:1 in a screenshot mid-open; the
  sidecar says the app actually sent 4:5, and 896x1088 came back exactly.

**One gap it exposed, now fixed:** the seed landed as `-1`. DeepInfra picks a seed when the
body carries none and reports it back, and we were dropping it — so Reuse Prompt could not
reproduce the image it was offering to reuse. `exec.seed` now takes the provider's seed.

## Added after that check, green offline, NOT yet run live

**Batch of four** (Fabio, 2026-09-20), the SDXL shape: the existing batch control, the
provider's own `num_images`, capped at 4 — which is both the control's cap and the
endpoint's published maximum. It is ONE call and ONE bill for the four images, which is
what lets MPI-854 raise a single confirm carrying the batch total.

Outstanding live check, about $0.002: set the batch control to 4 and generate. Four cards
should land from one dispatch, and the sidecar cost must be the cost of the CALL, not
multiplied per card.

## Known limits, deliberate

- **Cancel is not a refund.** Stopping a cloud job aborts the wait, not the provider's work:
  it may finish and bill. The abort is honest, the money may still be gone. The copy says so;
  a UI affordance for it belongs with MPI-854's confirm card.
- **One model ships**, FLUX Schnell, because it is the cheapest real dispatch on the
  platform and proves the path end to end. Fabio's other fourteen need tiles, previews and
  descriptions — that is MPI-853's work, and each one is an entry in `models.js` plus its
  endpoint id, nothing more.
- **Reference images** are wired (`cloud.imageField`) but no shipped model declares one yet,
  so the edit path is unexercised.

# MPI-918 Plan - Cloud edit models inside image Flows (two-pass)

> Planned 2026-10-01 (session 2a6034eb, under MPI-595 — a 2.0 gate, Fabio named it). Last open
> member of **MPI-985**; that umbrella closes with this card.

## Decisions (Fabio)

- 2026-09-25: candidates are **Klein 9B on DeepInfra** (`black-forest-labs/FLUX-2-klein-9b`, new
  ModelDef) + **Nano Banana** (2 Lite first). No Klein 4B cloud, no Qwen. DeepInfra only.
- 2026-10-01: **TWO-PASS, no new MpiNodes node** (replaces the card's "MpiNodes node calls
  `/deepinfra/generate`"). Why: `ComfyUi-MpiNodes/.claude/rules/registry-safety.md:30` lists
  `urllib`/`requests` under the reviewer's download-and-execute ban (a held version blocks the
  public pack, as 1.2.4-1.2.12 were); a node pin move would also re-gate the smoke and the Pod
  image. Two-pass reuses the shipped cloud path (key, credit gate, confirm, cost on the card)
  and works on a RunPod Pod too, which the node design could not.
- 2026-10-01: **Head Swap OUT** — its graph bakes the head-swap LoRA (`LoraLoaderModelOnly` 209,
  `Cubric-Flows/head-swap/workflow.json`), which no cloud model can load.

## The shape

Pass 1 runs the Flow's graph up to the edit stage and hands back the exact picture(s) the local
edit model would receive, plus their size. The app sends them to DeepInfra through the cloud
route. Pass 2 runs the same graph with a lazy `MpiIfElse` choosing a `LoadImage` of the cloud
result instead of the local sampler output; the crop is deterministic, so the stitch lines up.
The local loader branch never runs in either pass.

Facts this rests on (map 2026-10-01): `routes/deepinfra.js:454-663` (`imagePaths` absolute,
credit gate only when `estimateUsd > 0`, returns `viewUrls` + `cost`); a Flow dispatches
`model:{id:null}` -> always `runCommand` (`flowService.js:252`, `generationService.js:1026`);
`runCommand`'s completion carries no cost (`commandExecutor.js:2415`) while the cloud path sets
`generationSettings.cost` (`generationService.js:1273`); EVERY image an output node emits becomes
a card (`js/utils/comfyOutputUrls.js` `collectComfyOutputUrls`); two-leg flows already exist
(`flowService.js` `chainCallbacks` / `nextPassCallbacks`, MPI-623/900/997) but leg 1 LANDS a card.
None of the four graphs has an `MpiIfElse` today.

| Flow | Graph | Edit refs | LoRA rack | Candidates added |
|---|---|---|---|---|
| Scribble | `flow_scribble.json` | 1 | yes | Klein 9B cloud, Nano Banana 2 Lite |
| Draw It In | `flow_draw_it_in.json` | 1 (crop 163 -> stitch 169) | yes | Klein 9B cloud, Nano Banana 2 Lite |
| Outpaint | `flow_outpaint.json` | 1 | no | Klein 9B cloud, Nano Banana 2 Lite |
| Object Stamp | `flow_object_stamp.json` | 2 (both modes) | yes | Klein 9B cloud only |

## Phase 1: Klein 9B cloud model

- [ ] `klein-9b-cloud` ModelDef in `js/data/modelConstants/models.js` (shape of `flux2-dev-cloud`
  :1989: `provider:'deepinfra'`, `input_image_1..4`, `_cloudRatios`, ops t2i + edit,
  `multiReference`); `scripts/sync-deepinfra-prices.mjs` SHIPPED list + snapshot
  (`dev_configs/deepinfra-prices.json`, 1.5 c/MP, read 2026-10-01); agent knowledge per
  `docs/playbooks/add-model/07-agent-knowledge.md`. **Verify:** `sync-deepinfra-prices.mjs
  --check`, the cloud model tests, `npm test`; one paid edit run (~$0.02) on Fabio's yes.

## Phase 2: Two-pass seam, Scribble first

- [ ] A scratch pass: pass 1's outputs come back to the caller and NEVER land as a card (an
  opt on the queue/landing path, or a run that bypasses commit — pick the smaller after reading
  `generationService` commit; the pass-1 file is deleted after pass 2).
- [ ] Graph: `MpiIfElse` titled `Input_Cloud_Edit` (default local) between the local VAEDecode
  and a `LoadImage` `Input_Cloud_Result` scaled to the edit size; `Output_Edit_Input` (+ size via
  `PreviewAny`, the `Output_Prompt` precedent) for pass 1. Pass 1 / pass 2 select their output
  nodes by pruning the prompt, never by a second graph file.
- [ ] Orchestration in `flowService`: a cloud candidate in the slot -> pass 1 -> `/deepinfra/
  generate` (the same request `cloudExecutor.js:350` builds: credit gate, agent CONFIRM_COST,
  `estimateUsd`) -> pass 2; the cost lands on the final card's `generationSettings.cost`.
- [ ] Slot: cloud ids as extra candidates with a `modelParams` arm flipping `Input_Cloud_Edit`;
  the LoRA rack hides for a cloud pick; `flowAvailability` counts a cloud id only with a key.
  **Verify:** unit tests (prune, orchestration, slot), eslint, `npm test`; live Scribble run on
  the local engine (paid, Fabio's yes).

## Phase 3: Draw It In, Outpaint, Object Stamp

- [ ] Same seam in the three graphs; Object Stamp passes both refs (`input_image_1/2`).
  Nano Banana on the three one-ref Flows only. **Verify:** unit tests + `npm test`.

## Phase 4: Live runs + Fabio's look

- [ ] Paid runs: 4 Flows x Klein cloud + 3 x Nano Banana 2 Lite (~7 runs, ~$0.25; price and
  count to Fabio first). Check: stitch alignment (Nano Banana returns ~1K at a snapped ratio),
  cost on the card, LoRA rack hidden, one run with the Pod connected.
- [ ] Docs: `docs/cloud-generation.md` § Flows, `docs/playbooks/add-flow/any-of-models.md`,
  the four `existing-flows/*.md`; `UNRELEASED.md` bullet; close MPI-918, then MPI-985.

## Verification

**Verify mode:** user-ux (Phase 4: Fabio's look at the stitched results); Phases 1-3 auto.

## Remaining Work

Phases 1-4.

## Current State

2026-10-01: planned; Fabio approved two-pass + Head Swap out in chat. Card moved to `doing`.
Phase 1 NOT started (no code written). Read so far: the template is `flux2-dev-cloud`
(`models.js` ~1989: `provider`, `cloud.endpointId/imageField/imageFields`, `_cloudRatios(...,
1024, {min:128,max:1920})`, `imageSizedOps:['edit']`, `capabilities.multiReference`); local
`klein-9b` (~1120) is `type:'klein'`, `enhanceRecipe:'flux'`, `image:'klein-9b.webp'`. Picks to
make in Phase 1: `type:'flux2'` like the other FLUX 2 cloud defs (NOT `'klein'` - local-Klein
consumers like the style-LoRA system key on it), `enhanceRecipe:'flux'` (Klein's own prompts),
reuse `klein-9b.webp` as the preview. Price read live 2026-10-01: `api.deepinfra.com/models/
black-forest-labs/FLUX-2-klein-9b` -> `image_units`, 1.5 c/unit, default 1024x1024,
`usage_from_cost:false`. `scripts/sync-deepinfra-prices.mjs` `SHIPPED` (:61) is hand-kept: add
the endpoint there, then run the sync (it writes `dev_configs/deepinfra-prices.json`).

## Plan Drift

- 2026-10-01: the card text says Nano Banana takes ONE reference; MPI-919 (`c90e6effd`) and
  `a0e6b58a2` now collage 2-4 refs into one sheet (`routes/deepinfra.js:492-503`). Nano Banana
  still stays off Object Stamp (two refs): the collage is untested inside a stitch.

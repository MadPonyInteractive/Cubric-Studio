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

- [x] `klein-9b-cloud` ModelDef in `js/data/modelConstants/models.js` (shape of `flux2-dev-cloud`
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

## Completed

- 2026-10-01 (session 329cecad) Phase 1 code: `klein-9b-cloud` ModelDef after `flux2-dev-cloud`
  (name `FLUX.2 Klein 9B (Cloud)` - the local twin shares the bare name; `type:'flux2'` so it
  reads Dev's ratio table, same 128-1920 box; `enhanceRecipe:'flux'` -> guide `flux-2`); SHIPPED
  + snapshot (only the Klein entry changed); guide `docs/agent/models/flux-2.md` names it; tests:
  catalogue counts 16/15, multiref 4 slots, a Klein no-step-term price test. **Fixed a quote
  under-bill found on the way:** `formatPrice` used bare `toFixed(2)`, and 0.015 is 0.01499... in
  binary, so Klein quoted "$0.01" on the tile, the agent note and the confirm; now half a cent
  rounds up (`deepinfraPricing.js:325`, RED-proven). `npm test` 2641/0, eslint clean,
  `--check` clean. Cosmo read-back: t2i rank 15 / edit rank 11, paid, guide `flux-2`.

## Remaining Work

Phases 2-4.

## Current State

2026-10-01: Phase 1 DONE, live run passed ($0.015 billed = quote; validation.md). How it ran:
`npm run app:isolated` with `DEEPINFRA_API_KEY` exported in the same shell call (the route's
`resolveConnection` falls back to it; the RENDERER still reads no key, so cloud models show
uninstalled there and the connector would refuse) + a POST to the isolated server's
`/deepinfra/generate` with the `cloudExecutor.js:350` body. Reuse that for Phase 2-4 route-level
checks; a Flow run through the UI needs a key SAVED in the isolated profile. Next: Phase 2 step
1, the scratch pass.

## Plan Drift

- 2026-10-01: the card text says Nano Banana takes ONE reference; MPI-919 (`c90e6effd`) and
  `a0e6b58a2` now collage 2-4 refs into one sheet (`routes/deepinfra.js:492-503`). Nano Banana
  still stays off Object Stamp (two refs): the collage is untested inside a stitch.

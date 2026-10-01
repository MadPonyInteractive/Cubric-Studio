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

- [x] (code 2026-10-01) Scratch pass: pass 1 is a DIRECT `runCommand` (MpiToolOptionsResize's
  shape: outside the queue, `suppressLifecycleEvents`), its graph tapped with `Output_Display` +
  `Output_prompt`, so it never lands. Pass-1 picture -> `/comfy/stage-media-data-url` (the engine's
  `mpi_staged/`, the mask precedent; not deleted, like the masks).
- [x] (code) Graph: NO graph-file change - `js/utils/cloudEditGraph.js` transforms the injected
  graph in `runCommand` (after the op injector) from the FlowDef's `cloudEdit: {input, prompt,
  output}` node ids. Pass 2 replaces `output` (same id) with ImageScale(MpiLoadImage
  `Input_Cloud_Result`) and prunes to what `Output_*` reaches. See Plan Drift for why not MpiIfElse.
- [x] (code) Orchestration: `flowService.runCloudEdit` - pass 1 -> `/deepinfra/generate` with the
  `cloudRunFields` + `estimateRunCost` body (credit gate) -> pass 2 enqueued with `config.cloudEdit`
  {pass 2, image data URL, size, cost}; `generationService` whitelists it and lands `cost` on the
  card. A refusal reaches onError with the route's code. Agent CONFIRM_COST: not needed - a cloud
  candidate runs ONLY when picked, and an agent cannot pick a slot.
- [x] (code) Slot: Scribble lists `klein-9b-cloud` + `nano-banana-2-lite-cloud`; `flowModelIds`
  never resolves a cloud id unpicked; `flowModelChoices` hides one without a key; no LoRA phase
  and no cog for a cloud pick. `cloudEdit` joins `services/userFlows.js` FLOW_KEYS.
- [ ] **Verify:** unit tests (`cloud-edit-graph`, `flow-cloud-edit`), eslint, `npm test` DONE;
  live Scribble run (Klein ~$0.015, Nano Banana 2 Lite ~$0.034) on Fabio's yes - LEFT.

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

Phase 2's live run, then Phases 3-4.

## Current State

2026-10-01 (later): Phase 2 CODE DONE, offline-verified (`npm test` green, see Completed);
NOT yet run live. Next: the live Scribble run, which needs Fabio's yes (money + his engine on
48188, shared with an isolated app). Route for it: `app:isolated` with the env key, then a
playwright-cli page in THAT instance: add the cloud id to `state.s_installedModelIds` (the
renderer reads no env key), `setFlowModel('scribble', ...)`, `submitFlowGeneration` with a
drawing; check the card lands with `generationSettings.cost` and the drawing was rendered.
Phase 3 starts from `research/phase3-graph-map.md` (Agent 86's map; Object Stamp needs a second
input keyed by mode, 106 Auto / 201 Manual).

Phase 1 (earlier the same day): DONE, live run passed ($0.015 billed = quote; validation.md). How it ran:
`npm run app:isolated` with `DEEPINFRA_API_KEY` exported in the same shell call (the route's
`resolveConnection` falls back to it; the RENDERER still reads no key, so cloud models show
uninstalled there and the connector would refuse) + a POST to the isolated server's
`/deepinfra/generate` with the `cloudExecutor.js:350` body. Reuse that for Phase 2-4 route-level
checks; a Flow run through the UI needs a key SAVED in the isolated profile. Next: Phase 2 step
1, the scratch pass.

## Plan Drift

- 2026-10-01: NO `MpiIfElse` switch. ComfyUI validates every node an output can reach before it
  runs any (the lazy switch only skips EXECUTION), so the local `UNETLoader` behind the switch
  refuses the prompt ("value not in list") for a user without local Klein, the main user of a
  cloud pick. Pruning in app code reaches nothing local and needs no graph-file edit at all.

- 2026-10-01: the card text says Nano Banana takes ONE reference; MPI-919 (`c90e6effd`) and
  `a0e6b58a2` now collage 2-4 refs into one sheet (`routes/deepinfra.js:492-503`). Nano Banana
  still stays off Object Stamp (two refs): the collage is untested inside a stitch.

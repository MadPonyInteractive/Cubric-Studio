# MPI-1038 - Tile Detailer Flow (detail, optional upscale first)

## Goal

A Flow that redraws a picture tile by tile with FLUX.2 Klein 9B to add real detail, with an
OPTIONAL lanczos upscale that runs BEFORE the detail pass (Fabio, 2026-10-08: "not just an
upscaler ... upscaling should be optional and should happen before the detailing phase").
Detail-only = upscale Off. Recipe = Fabio's bench "Flow Tile Detailer" (MPI-623 validation.md
§ Super upscaler): lanczos 2x -> `ImpactMakeTileSEGS` 1024 / crop 1.5 / overlap 200 /
dilation 30 / irregularity 0.7 "Reuse fast" -> Klein 9B int8 in `DetailerForEachPipe`,
4 steps lcm/normal cfg 1, **denoise 0.35** (his eye: 0.35 right, 0.45 changes too much).

## Shape (decided here, product calls flagged in the brief)

- id `tile-detailer`, title **Tile Detailer** (Fabio's own name for the bench graph),
  op `flowTileDetailer`, workflow `flow_tile_detailer.json`, `mediaType: 'image'`.
- `requiredModels: [{ label: 'Base model', models: ['klein-9b'] }]`, loaders baked like
  Outpaint (`flux-2-klein-9b-int8-convrot`, `qwen_3_8b_int8_convrot`, `flux2-vae` - the app's
  own dep filenames, byte-same as the bench). No cloud model (tiles need the local graph).
- One image slot `image1` -> `Input_Image` (MpiLoadImage). `result: { compare: 'image1' }`.
- Fields: `Input_Upscale_Factor` radio **None (detail only) / 1.5x / 2x**, default 2x;
  `Input_Denoise` slider 0.15-0.60, default 0.35; `positive` optional text = the LOOK, not
  the scene (the per-tile prompt trap: every tile is sampled with it, a scene prompt paints
  the scene into flat sky - MPI-623 sky ghosting, `docs/models/krea2/upscaling.md` § Traps).
- Graph: `Input_Image` -> `ImageScaleBy` lanczos x `Input_Upscale_Factor` (1.0 = no-op) ->
  tiles -> `DetailerForEachPipe` (non-debug twin of the bench node) -> `Output_Image`.
  `Input_Seed` MpiInt, `Input_Positive` PrimitiveStringMultiline; negative untitled (cfg 1).
- OUT of v1: 360 wrap pad (pad-only leaves a tonal step, xf ghosts, the cut needs a node;
  the 360 Flow upscales its own pano), 4x (run it twice; Fabio: an 8K detail pass is
  overkill), an upscale-model choice (lanczos is the proven pre-detail step).

## Phases

1. **Bench graph.** Generator script (scratch) writes the raw LiteGraph
   `comfy_workflows/raw/flow_tile_detailer.json`; prove it on bench :8188 under the GPU lease:
   a ~1 MP picture at None and at 2x. **Verify:** both runs succeed, output dims = input x
   factor, no tile grid / colour blocks by eye at 1:1.
2. **Repo wiring.** `node scripts/sync-raw-workflows.mjs` (gate: validate-injection-rules);
   op in 4 files (`commandRegistry.js`, `universal_workflows.js`, `js/core/operationRegistry.js`,
   `operation_registry.json`, `appVersionIntroduced` = APP_VERSION); FlowDef in
   `flowsRegistry.js`; `tests/inject-params-titles.test.cjs` case.
   **Verify:** inject test + `node --check` on touched JS + `npm run lint`.
3. **Agent knowledge** (playbook 07): description's first sentence = the ask; field meaning
   in `docs/agent/flows.md`; `tests/agent-flow-handover.test.cjs` `runs`.
   **Verify:** the four agent tests green.
4. **Live run** in an isolated app (`npm run app:isolated`, never :3000): run None + 2x,
   card lands, compare works, Reuse reopens with inputs. **Verify:** cards + sidecar
   `flowId`/`flowInputs` on disk.
5. **Docs + announce:** `docs/playbooks/add-flow/existing-flows/tile-detailer.md`,
   `docs/releases/UNRELEASED.md` roster + entry. Graphics (tile + hero) = `/mpi-flow-graphics`
   after Fabio's eye on results.

## Verification

**Verify mode:** user-ux

Automated: phase Verify lines above. Human: Fabio runs the Flow on his own picture (detail
only, then 2x) and judges the detail.

## Current State

2026-10-08 ~23:30: phases 1-4 + the Flow doc DONE and verified (validation.md); card in
doing/validating. Bench found detail-only on a SMALL picture redrew too much -> detailer
guide_size 1024 / max_size 1536 (benched, adopted). Live in-app runs x2 + x1 landed with full
sidecars; isolated instance stopped. Provisional preview = crop of the x2 bench run.
2026-10-09 eye-test, part 1 (Fabio, on a 24 GB Pod, None, a photo smaller than a tile): "it just
detailed the whole thing without tiles". CAUSE CONFIRMED by Fabio ("I didn't account for that"):
ImpactMakeTileSEGS bbox 1024 makes a picture under 1024 px ONE tile, so detail-only is one
whole-image pass (guide_size 1024 then samples it at ~1 MP). Working as built, not a bug. Open:
whether he still wants to review the workflow, or tiles on small pictures (a smaller bbox, or one
derived from the picture - bench it first). Pod: the run worked there (Impact baked in the image).
2026-10-09 CORRECTION (read Impact source, `segs_nodes.py` MakeTileSEGS + `utils.make_crop_region`;
simulator `tiles.py` in session scratch): under 1024 is NOT one tile. bbox clamps to the short side
(irregularity pads it to 1068 / overlap 222), so 800x533 = 3 tiles of 533, BUT crop_factor 1.5 makes
each tile SEE ~the whole picture -> reads as one whole-image pass. 800x533 x2 = 2 tiles each seeing
99%. Real tiling (a tile sees part of the picture) starts once the OUTPUT passes ~1600 px a side:
1344x768 x2 = 8 tiles at 59%, 1920x1080 x2 = 15 at 30%. Big inputs: 4000x6000 x2 = 150 tiles,
8000x12000 output (RAM on a 16 GB box - unchecked).
2026-10-09 ~10:40 DIRECTION CHANGE (Fabio, after 5 Pod runs in `Qwen 2.1/Media/flowTileDetailer_001-005`):
"this is not a flow - it should be part of the UPSCALE operation for every model; far superior
to the Use Grid option". NEXT = a BRAINSTORM (mpi-brainstorm) with Fabio's ideas on how tile
upscale lands in the per-model upscale op (the op popover: Use Grid, Upscale 1.5x/2x/3x/4x,
Denoise, Style, Stylization). The Flow stays built + committed; whether it ships, is hidden or
is removed is part of that brainstorm. Inputs for it: the tile maths above, the per-tile prompt
trap (Plan Shape), and that 4x on a big photo is 150+ tiles.
- Previews on the Pod looked bad: NOT this graph - the Pod lacks `taef2_decoder` (Latent2RGB
  fallback); split to MPI-1050 (remote engine assets one-shot install). Final images were clean.
- Flow art PAUSED (moot if it is not a Flow): candidate 1 (cloud-tile walk, real Impact masks
  re-run in numpy) in `art/candidate1_tile.png` + `art/candidate1_hero.mp4` (stand-in plates);
  generators kept in `art/td_art.py` (tile layout + cloud masks) and `art/td_build.py`
  (`python td_build.py <input> <output> <factor> <outdir> [still|hero|both] [active] [cx]`).
  The 28-tile bench run (2688 village x2) was cancelled before it ran.
- Noticed: the status bar read `DETAILING · 0%` deep into a run (detailer steps may not reach
  the progress tracker). Not checked. On a "1":
/mpi-flow-graphics (tile + hero), then the UNRELEASED.md entry, then close-out (commit raw +
runtime + preview with `--only`; NOT via sync-raw-workflows while MPI-936's raw is dirty).
Nothing committed yet. Session scratch tools (gone with the session): `make_tile_detailer.py`,
`run_td.py`, `cmp_td.py`, `live_td.py`, `probe_td_ui.cjs`.

## Completed

- Phase 2 wiring, phase 3 agent knowledge, phase 5 existing-flows doc (see Current State).

## Remaining Work

Phase 1 bench proof; provisional preview; phase 4 live run; UNRELEASED entry + graphics after
Fabio's eye (close-out: a Flow with no art is not announced).

## Plan Drift

- 2026-10-08: `sync-raw-workflows.mjs` NOT run - it commits every git-changed raw and stages
  every dirty runtime file, and MPI-936 (peer) holds uncommitted `raw/qwen_image_2_1.json` +
  runtime. Ran its converter + validator on this one file instead (same steps for a bare-name
  raw); runtime = converter output. Commit raw + runtime with `--only` at close-out.
- 2026-10-08: UNRELEASED.md has no Flows roster since the 2.0.1 clear, and close-out.md says a
  Flow without art is not announced: the entry moves to the graphics step.
- 2026-10-08: recipe change - DetailerForEachPipe guide_size 64 -> 1024, max_size 1024 -> 1536
  (detail-only on a small picture; evidence in validation.md). Identical for 1024 tiles.

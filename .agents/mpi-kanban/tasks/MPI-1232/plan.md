# MPI-1232 - bench plan (draft 2026-10-22, awaiting Fabio's GPU go)

Decisions and findings: `brief.md`. This file is the bench only. Nothing is wired before it passes.

## Where it runs

- **G:\ComfyUi bench** (0.42.1, Impact Pack present), driven over its own API port, never `:3000`.
- Every GPU job wrapped: `gpu_lease.py run --poll 2 -- <cmd>`; nothing runs beside an unleased peer job.
- Graphs = API exports of the SHIPPED Tiles group (`krea2_t2i_sfw.json`, `flux3_t2i.json` upscale
  branch), so the bench measures what ships. Only the bench copies change (wildcard string, filter,
  bbox, overlap). Results + exact graphs land in `tasks/MPI-1232/research/`.

## Inputs

- **Face photo:** one real photo, 2+ people, faces ~150-300 px, ~1536 px long side. Fabio picks it
  (or I take one from a Flux 3 tests card he names).
- **Field picture:** the UFO `upscale_002` (6048x3456) - stage 2 only, cropped to the grass field
  region so a run is minutes, not an hour.
- Same seed, same denoise as today's Tiles group, 2x, tile 1024, overlap 20% of tile (floor 128).

## Stage 1 - does a per-tile prompt work, per model (12 runs)

Tile captions hand-written for this stage (I look at each crop and write 1-2 lines), so the
question is the wildcard mechanics, not describer quality.

| # | variant | Krea 2 | FLUX.3 Klein |
|---|---|---|---|
| A | today: prompt-less tiles | 1 | 1 |
| B | `[ASC]` per-tile (REPLACES conditioning: Flux guidance / ReferenceLatent dropped) | 1 | 1 |
| C | `[CONCAT]` per-tile (keeps base positive) | 1 | 1 |
| A-C | same three, faces subtracted (`filter_out_segs_opt`, face_yolov8n) + one face pass after | 3 | 3 |

Eye-check at 1:1: faces (identity vs input), tile overlaps (seams), the busiest texture tile.
Read per run: wall time, peak VRAM, whether B's graph silently lost guidance (log check).

## Stage 2 - what the describer must see (no GPU for captions where possible, then 3 runs)

On the field crop, three captions for the same tile:
1. tile crop alone;
2. whole-picture caption once + "this is the lower-left part; describe only what is inside this crop";
3. whole picture with the tile outlined, same question.
Captions via the app's own `describeImage` route (local describer on the bench = no spend). Then
the stage-1 winner redraws the field once per caption (3 runs). Pass = trees/grass read as
trees/grass, and no UFO or people painted into the tile.

## Stage 3 - only if stages 1-2 pass (3 runs)

- People pass: face-only vs whole-person (`person_yolov8n-seg`) subtraction, winner model (2 runs).
- Overlap: 20% vs fixed 200 on a 512 tile, 1024 picture (seams + count) (1 run each side, reuse A).

## Total

~18 GPU runs, each a 2x tile upscale of a ~1.5K picture (minutes each), plus ~6 local captions.
No paid model, no RunPod, no download (face/person yolo + both models already on the bench -
checked before the first run; anything missing = stop and ask).

## Current State (2026-10-22 03:45)

- Fabio's GPU go given. Card in doing. Driver `research/tilebench.py` (shipped graph, sets `Input_*` like the
  app: wf_type 7, tiles on, x2, denoise 0.2, seed 12345, turbo off, empty prompt; patches only the tile
  detailer `wildcard` + face `filter_out_segs_opt` + a face DetailerForEachPipe after). Rect port = `tileCount.js` on 5 sizes.
- Face photo: `Deepinfra model tests/Media/crop_001.png` -> 1280x800 lanczos = `research/input_face.png`
  (not committed; recreate the same way). 8 tiles at 2x; both faces cut across 3-4 tiles. Captions: `research/captions_face.json`.
- Krea 2 stage 1 (6 runs) queued via `research/stage1.sh krea2` behind Moss image 2's lease; results ->
  `research/out/face_krea2_*.png` + `research/runs.jsonl`. Not yet seen.
- FLUX.3 blocked: Fabio reinstalling models into `M:\CubricModels` (FLUX.3 Klein + flux2-vae in his queue).
  A copy of `flux3-image-klein-base-int8-convrot` sits in `G:/models/diffusion_models` - delete it once M: has FLUX.3.

## Plan Drift

- Stage 1 keeps today's fixed overlap 200 (20% of 1024 = 205, same thing); overlap only matters in stage 3 (small tiles).
- Face pass runs with no wildcard in every variant, so it is constant and the tile variants stay comparable.

## Done when

A verdict per model: B or C (or neither -> option B app-side tiling), face pass in or out, describer
context 2 or 3, overlap rule. Written into `brief.md` Decisions, then Fabio picks what gets wired.

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

### Current (2026-10-22 ~13:50): stage 1 COMPLETE, 14 runs (12 turbo + 2 FLUX.3 base). Findings in brief.md
"Stage 1 results". Fabio's verdict: face pass ships, base = turbo (bench on turbo). Next: stage 2 (UFO field, describer context). Open to-do
from Fabio in checklist.md: Cosmo's upscale should open the image workspace (latents visible).

### Update 2026-10-22 (later the same day)

- Driver updated (Fabio). Running FLUX.3 B/C f1 turbo + base checks A/B f1 (`TURBO=0` env on tilebench, tag `_base`;
  sheets.py adds the BASE columns when they exist).
- **FLUX.3 A f1 (turbo, faces on): the face pass RESCUES it** - no dotted mesh, both faces close to the input.
  The faces-off mesh/painted look comes from faces being re-denoised across 3-4 tiles (MPI-1181's drift).
- Folded in (Fabio's report): Cosmo started a tiled upscale and said "many tiles, progress line in the chat";
  `_tilesNote` (services/agentLoop.mjs) gave the count only "asked how many". Now the start reply must name the
  count + the status bar, and never point at the chat's 0-of-1 line. Test in tests/agent-loop.test.cjs; 209 pass.

### Update 2026-10-22 (morning)

- Overnight (turbo on): 5/12 landed before the machine crashed (a peer's video-model run): Krea 2 A/B/C f0, A/B f1,
  ~200-240 s each, all 2560x1600. `stage1.sh` now skips outputs that exist; resumed for Krea 2 C f1 + all FLUX.3.
- `research/sheets.py <model>` (run with plain `python`, PIL is in user site) -> `out/sheets/<model>_<region>.png`:
  input | A B C faces off | A B C faces on, 1:1 crops of both faces + shirt + mural seams.
- Krea 2 so far: no seams anywhere; identity holds in every variant. B/C slightly crisper than A (beard, paisley).
  Faces ON is the clear win: the young man's face goes soft in A f0, sharp and true in A f1. The shirt band at
  y~1430 is in the SOURCE (input_face.png), not a seam.
- Resumed batch: Krea 2 C f1 (256 s) + FLUX.3 A/B/C f0 (135-155 s) landed. Krea 2 stage 1 COMPLETE (6/6).
  FLUX.3 f1 x3 NOT run: Fabio stopped the GPU for a driver update. Resume = `bash research/stage1.sh flux3` (skips done).
- FLUX.3 Turbo, faces off, every variant BAD: beard -> dotted mesh, young man's face painted/posterised; B and C add
  wet blotches on his cheek. Reproduces MPI-1181 brief.md:340 ("Turbo tile upscale: bad", Fabio 2026-10-19).
  Per-tile prompts do not rescue it. Open (Fabio's call): 2 base (turbo off) runs, A f1 + B f1, ~4-5 min each.
- G: FLUX.3 copy is byte-identical to M: (sha256 8949ecfc...) but still there: auto mode blocked the delete; Fabio's to remove.

## Plan Drift

- Stage 1 keeps today's fixed overlap 200 (20% of 1024 = 205, same thing); overlap only matters in stage 3 (small tiles).
- Face pass runs with no wildcard in every variant, so it is constant and the tile variants stay comparable.
- 2026-10-22: every bench run is TURBO ON (Fabio: turbo-off upscales take forever). Krea 2 = turbo distill LoRA
  (3/6 steps), FLUX.3 = distilled Klein (8 steps). The first turbo-off Krea 2 run was killed after ~12 min unfinished.

## Done when

A verdict per model: B or C (or neither -> option B app-side tiling), face pass in or out, describer
context 2 or 3, overlap rule. Written into `brief.md` Decisions, then Fabio picks what gets wired.

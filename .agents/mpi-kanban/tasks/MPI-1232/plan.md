# MPI-1232 - Use Tiles redone: wiring plan (2026-10-22) + the bench that decided it

Decisions and findings: `brief.md`. Footprint map with file:line: `research/footprint.md`.

## Wiring plan (Fabio's go 2026-10-22: "scenery short names per tile + people pass (prompt-less) + face pass rules")

**Shape of a Use Tiles run, Describe each tile ON:**
1. App: tile RECTS of the scaled picture (same maths as `ImpactMakeTileSEGS`, ASC order) -> one outlined copy of the
   whole picture per tile -> the user's describer answers `SCENERY_Q` (bench method 8: "ignoring any people, name what
   fills that area in five words or fewer") -> `[CONCAT][ASC]name1[SEP]name2...` -> `Input_Tile_Prompts`.
2. Graph: grid tiles MINUS people boxes (`filter_out_segs_opt`), each with its name appended to the box text
   (`[CONCAT]` keeps Flux guidance / the base positive) -> PEOPLE pass (person boxes, same pipe, no wildcard: the box
   text only, empty box = prompt-less) -> FACE pass last (face SEGS, same pipe, no wildcard) to restore face detail a
   shrunk whole-person sample loses. Identity holds because no describer word ever reaches a person.
**Describe OFF:** today's prompt-less tiles, plus the people + face passes (they are the stage-1/3 win on their own).

### Phase 1 - graphs (comfy-worker; owns `comfy_workflows/raw/*`, the 14 runtime files, `scripts/workflow_generation/*_template.json`)
- 7 raw sources (krea2, flux3, moss, klein, chroma, sdxl `_t2i_template.json` + `qwen_image_2_1.json`) -> sync
  (`scripts/sync-raw-workflows.mjs`) -> 14 runtime. Follow `docs/playbooks/common/workflow-authoring-entry.md`;
  read `.claude/rules/comfy_injection.md` (naming law) first. Ids per graph: `research/footprint.md` § A.
- Add per graph: `Input_Tile_Size` (MpiInt -> MakeTileSEGS `bbox_size`), `Input_Tile_Overlap` (MpiInt -> `min_overlap`),
  `Input_Tile_Guide` (MpiInt -> tile detailer `guide_size`; `max_size` = 1.5x via a math node or a second Input),
  `Input_Tile_Prompts` (MpiText -> tile detailer `wildcard`, default "" = today). People: UltralyticsDetectorProvider
  `bbox/person_yolov8n-seg.pt` -> BboxDetectorSEGS (thr 0.5, dil 10, crop 1.5) on the SCALED image -> MakeTileSEGS
  `filter_out_segs_opt` + DetailerForEachPipe after the tile detailer. Face: `bbox/face_yolov8n.pt` -> BboxDetectorSEGS
  (crop 3.0) -> DetailerForEachPipe last. Both reuse the tile pipe, steps/cfg/denoise wiring, wildcard "".
  Keep the model paths `bbox/...` with forward slashes (comfyController.js:1800, MPI-246). Both .pt are engineAssets:
  installed with the engine, never declared per model (flowsRegistry.js:990).
- Grid: leave the graph's Grid nodes; the app stops injecting `Input_Auto_Grid` (false = one-pass USDU, still the
  non-tile path). Fix the Krea2 tile detailer title "Tile detailer (Klein 9B)".
- **Verify:** each family runs on the G: bench (:8188, gpu_lease) with injected size 512 + prompts + a group photo;
  output size right, people + face pass ran (log "# of Detected SEGS"), no seams. One run per family, turbo on.

### Phase 2 - tile maths, controls, Grid removal (frontend-worker; owns js/ files below) - parallel with Phase 1
- `js/utils/tileCount.js`: `tileRects(w,h,factor,{bbox,overlap})` (the port in `research/tilebench.py:tile_rects`,
  ASC-sorted) + `tileCount` = its length; `overlapFor(tile)` = round(0.2 x tile), floor 64 (1024 -> 205 ~ today's 200);
  `runTileCount` reads `Input_Tile_Size`/`Input_Tile_Overlap`. All three counters (label, `_tileStages`
  commandExecutor.js:2115, agent quote agentDispatch.js:981) go through it.
- Prompt box (`PromptBoxControls.js`): delete `useGrid` (764-815) - KEEP the `promptbox:upscale-split` event, it
  re-mounts the factor radio (933). With Tiles on show **Tile size** (256/512/768/1024/1536, default 1024, label
  carries the live count) and **Describe each tile** (default on; hover: "names each tile in a few words; people and
  faces are never described"). Defaults in `promptControlDefaults.js`; `commandRegistry.js:461,479` help + components.
- `generationControls.js:697-723`: drop `Input_Auto_Grid`; inject size/overlap/guide (guide = max(1024, tile)).
- Old `useGrid`: `promptReuse.js:463` + routines (`routineModel.js:36`) map `useGrid: true` -> Tiles on, never fail.
  Fix the dead keys there (`Auto_Grid`, `Upscale_Factor` -> the `Input_` names) and `MpiGalleryBlock.js:1654`.
- Progress: people + face passes are extra detailer bars - count them in `_tileStages` (detected count is runtime:
  use the "# of Detected SEGS" line like `detailer`), drop the stale `'krea2_t2i.json': {postTile: 1}`
  (progressStages.js:111), add `DetailerForEachPipe` to progressAggregator.js:77-86.
- **Verify:** `tests/tile-count.test.cjs` (new rects + overlap cases, old counts at 1024 unchanged within the 200->205
  shift), `tests/desktop/prompt-box-use-tiles.spec.js` rewritten for size + Describe (Grid gone), `npm test`, `npm run lint`.

### Phase 3 - Describe each tile (after Phase 2; owns a new `js/services/tileDescribe.js` + one server route)
- Server: `POST /tiles/outlines {imagePath, rects}` -> sharp draws one red-outlined copy per rect (scaled to the
  describer's 1 MP, outline ~0.3% of the long side) into the project's temp dir; returns paths. Reuse the
  seamlessOps temp/cleanup pattern.
- Client: `describeTiles(image, rects)` -> `describeImage({imagePath, question: SCENERY_Q})` per tile on the user's
  backend (comfy 4B or endpoint), strip quotes/dots, join `[CONCAT][ASC]...[SEP]...` -> `Input_Tile_Prompts`.
  A failed caption = that tile gets "" (prompt-less), never a failed run; say so in the end toast.
- Visible: ONE queue-panel row "Naming 15 tiles" with i/N while captions run, then the upscale row. Endpoint
  describer bills: show the price before a big run (150 tiles on a 4000x6000 at 2x).
- **Verify:** unit test for the join/order (rects ASC = wildcard order) and the failed-caption fallback; one live
  `npm run app:isolated` Use Tiles run (Fabio's yes for the GPU first) on t2i_004-like picture.

### Phase 4 - agent, MCP, docs (after 2-3)
- Params: `tiles` text rewritten (names per tile, people/faces untouched; "1024 px" goes) in agentLoop.mjs:122,
  routes/mcp.js:495, commandRegistry.js:461, SKILL.md:73, docs/agent/upscaling.md:13-50 (pinned by
  tests/agent-tiles.test.cjs:76-110 - update the pins); new `tileSize` named param through connector NAMED_PARAM_KEYS
  (connector.js:467), `_MODEL_NAMED_KEYS`, `_SENT_KEYS`, `resolveNamedParams`; Grid out of agent-tiles.test.
- Docs: krea2/upscaling.md (Shape + Traps + Grid), krea2/README.md:48, injection.md:186, agent/models/flux-3.md:44
  (wrong: its tile pipe DOES take Input_Positive), moss-image.md:35, rules rows (ask Fabio before editing
  `.claude/rules/` - CLAUDE.md rule 5), releaseNotes/UNRELEASED.

### Decided (Fabio 2026-10-22, "Tile upscaler improvements 5")
- Tiles denoise default **0.3** (was 0.2). People pass denoise **0.25** (own value, not the tile denoise). Face pass
  keeps the tile denoise. Overlap **20% of tile, floor 64**. GPU go for Phase 1 verify: one run per family, turbo on, leased.

## Parallel Batch: Phase 1 + Phase 2 (2026-10-22)
- **P1 graphs** (comfy-worker). Ownership: `comfy_workflows/raw/{chroma,flux3,klein,krea2,moss,sdxl}_t2i_template.json`,
  `comfy_workflows/raw/qwen_image_2_1.json`, the 6 matching `comfy_workflows/scripts/workflow_generation/*_t2i_template.json`,
  the 14 runtime `comfy_workflows/*.json`. **Verify:** sync script clean + a JSON check that every runtime graph has the
  4 new `Input_*` nodes, person + face detector chains; GPU bench later by the orchestrator.
- **P2 app** (frontend-worker). Ownership: `js/utils/{tileCount,promptReuse}.js`, `js/data/{routineModel,progressStages,
  projectModel,promptControlDefaults,commandRegistry,generationControls}.js`, `js/services/{progressAggregator,
  commandExecutor,generationService}.js`, `js/shell/agentDispatch.js`, `MpiGalleryBlock.js`, `PromptBoxControls.js`,
  `tests/{tile-count,tile-post-pass-stage,agent-tiles}.test.cjs`, `tests/desktop/prompt-box-use-tiles.spec.js`.
  **Verify:** `npm test`, `npm run lint`.
- Contract between them: MpiInt `Input_Tile_Size` (bbox_size, default 1024), `Input_Tile_Overlap` (min_overlap, 205),
  `Input_Tile_Guide` (guide_size, 1024), `Input_Tile_Max` (max_size, 1536); MpiText `Input_Tile_Prompts` (wildcard,
  default "" - Phase 3 fills it). App injects the four ints when Tiles is on. People-pass denoise 0.25 is BAKED in the
  graph (no input): it protects people whatever the user's denoise. Face pass uses the tile denoise.
- Silhouettes instead of boxes = move `person-yolov8n-seg` to `ultralytics/segm/` (assetDeps.js:994) - later.
- Separate checklist to-do stays open: Cosmo's upscale opens the image workspace.

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

### Current (2026-10-22 night, session "Tile upscaler improvements 5"): Phase 1 + 2 RUNNING in parallel

- Fabio answered the Open calls (see "Decided"). Claim `state/files/ca54f9c1-mpi1232.json` covers both batches.
- **Phase 1 landed (uncommitted, NOT staged):** 7 raw + 6 gen templates + 14 runtime. Scripted patch (not a frontend
  round trip) - scratch `patch_tile_group2.py` / `convert_and_bake.mjs` in the session scratchpad, converted against the
  bench :8188. Orchestrator fix: `Input_Tile_Guide`/`Input_Tile_Max` are **MpiFloat** (DetailerForEachPipe guide/max
  are FLOAT; an MpiInt link fails the type check). Worker had staged everything + marked the claim complete - undone.
- **Phase 2 landed + reviewed:** tileRects/overlapFor, Tile size + Describe each tile controls, Grid gone, 4 ints
  injected, `denoiseDefaultFor(op, tilesOn)` (tiles 0.3 / op default 0.2) used by BOTH the agent path and the slider
  (slider follows the tiles toggle while no denoise is saved). npm test 3532/0 fail, lint 0, desktop spec passes.
- **GPU bench:** krea2, flux3, moss, qwen pass (validation.md). Fabio 2026-10-23: a change copied into every graph is
  benched on ONE model, **Klein 9B** (no turbo toggle - one distilled checkpoint) - `bash research/phase1.sh klein_9b_t2i`.
  No more per-family runs. Re-convert after any raw edit: `node research/convert_nostage.mjs` (no commit/stage, :8188).
- **Decided (Fabio 2026-10-23):** both labels say "up to N tiles" (people boxes drop tiles; count unknown up front);
  the stage total stays the grid count and self-corrects. `_tileStages` unchanged on purpose. Phase 4: Cosmo's
  `_tilesNote` must say "up to N" too.
- **Next:** Phase 3 (Describe each tile: outlines route + describer + one queue row).

### Earlier (2026-10-22 late): BENCH DONE, wiring plan written (top of this file), nothing wired yet

- Fabio chose: scenery short names per tile + prompt-less people pass + face pass. Stage 3 (people pass) ran on
  t2i_004 at 0.35: describer mistakes no longer reach people; slight darkening. Next action: Phase 1 + Phase 2 of the
  wiring plan (disjoint: graphs vs js/), after Fabio answers the "Open" calls (denoise default first).

### Earlier (2026-10-22 evening): stage 2 COMPLETE

- 4 caption methods (added 4 = the card's own t2i prompt as context) + 5 runs at 0.2 (A, cap1-4) + an oracle
  (hand-written true caption) at 0.2 + A/oracle/cap3 at 0.45. Driver `research/stage2.py` (prep | caption <m> | sheet)
  + `stage2.sh`; `tilebench.py` now takes `DENOISE=` (logged in runs.jsonl). Results: brief.md "Stage 2 results".
- Headline: at 0.2 no tile prompt changes anything; at 0.45 the prompt decides content (right caption -> fields,
  wrong -> cliff, none -> ripples). No describer method named the field. Stage 3 waits on Fabio's call.
- Cosmo-upscale to-do: routing proven right (lands in the card's history), the view move unproven; see checklist.
- Later the same evening (Fabio's ideas): method 5 (outline + "what real thing is there") and 6 (outline + name it in
  <=5 words), on 4B and 8B (`DESCRIBER=` env), redrawn at 0.45. Short names = no hallucinated objects, but on the
  mushed field the names are wrong (ocean/cliff/fog). Next candidate: the same on a READABLE picture (t2i_004 itself,
  2x, 0.35), A vs short names. Fabio's denoise bands + "name the thing" rule are in brief.md and memory.

### Earlier (2026-10-22 ~13:50): stage 1 COMPLETE, 14 runs (12 turbo + 2 FLUX.3 base). Findings in brief.md
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

# MPI-623 checklist

Phase list and rationale live in [plan.md](plan.md) (see its Phase 0 amendments 6-10).
Evidence: [research/phase0-log.md](research/phase0-log.md),
[research/measurements.md](research/measurements.md).

## Phase 0 - prove the pipeline (bench only, NO product code)

- [x] SplatKit + ComfyUI-Mickmumpitz-Nodes installed on the standalone bench
      (`G:\ComfyUi`, port 8188). Commits `f59de25` / `4d5ff7c`, both MIT.
      **Zero pip installs needed** - the portable env already satisfies all six.
- [x] Dataset built end to end from a Poly Haven JPG equirect (`abandoned_games_room_02`,
      8192x4096, CC0) -> `images/` (96 pinhole cube faces) + `sparse/0/{cameras,images,
      points3D}.bin`. 139.0 s, 143 MB. **Poly Haven serves a tonemapped JPG** - the
      `.hdr`/`.exr` worry in brief.md is void.
- [x] SplatKit runtime downloads landed: MoGe checkpoint (1.26 GB) and `colmap_sphere`
      (37 MB, SHA-verified by the node). BSD-3-Clause notice at
      `docs/SPHERESFM-THIRD-PARTY-NOTICES.txt` in the pack.
      **A third download exists** that brief.md missed: RAFT weights, for HiRes Composite
      with `base_mode=wan`.
- [x] Brush v0.3.0 win-x64 downloaded and SHA256-verified
      (`b68e3e9c...fcd6`). All three of Vision's targets are published.
- [x] **THE GATE - PASSED.** Brush trained SplatKit's COLMAP output to a `.ply`
      (566 820 splats, SH degree 3) in 468 s, and a **held-out eval view at 5 000 steps is
      unmistakably the source room**. That is the gate on its actual wording, not merely
      format compatibility. Decision 3 in plan.md stands; no re-open.
- [x] Measurements recorded in `research/measurements.md`.
- [x] Brush stdout checked - see the finding below; the planned parse cannot work.
- [x] ComfyUI core `RenderSplat` loads and renders the Brush `.ply`
      (`Load3DAdvanced` -> `File3DToSplat` -> `RenderSplat`), 4 frames @1024 in 16 s.
- [x] Iteration tiers decided from the ladder: **Draft 5 000** (~1 min, 9 MB) and
      **Scene 30 000** (~8 min, 126 MB) - see measurements.md for why the middle tier is
      not worth shipping.

### Phase 0 findings that change the build

- [x] **Brush writes ZERO bytes to stdout when not a TTY.** `indicatif` suppresses its bar,
      so plan.md's "strip ANSI, match `N/M Steps`" has nothing to match. Poll
      `--export-path` for `export_{iter}.ply` instead. Silence is normal, not failure.
- [x] **Never point Brush at a raw SplatKit dataset root.** It holds four COLMAP models;
      the two under `_spheresfm_work/` use camera model 11 (SPHERE) and Brush picks
      **nondeterministically**, so the same command trains fine once and dies with
      `Invalid camera model` the next. Delete `_spheresfm_work/` (disposable, 60% of the
      dataset) or copy `images/` + `sparse/0/` to a clean root first.
- [x] **The Scene workspace camera must stay near the bake rail.** An outside-in orbit of
      an interior scene renders pure floaters while a held-out training view of the same
      `.ply` is a clean room. Inherent to 3DGS, not a renderer bug.
- [x] **macOS has no `colmap_sphere` build.** On Mac the 3D Scene Flow is remote-pod only.
      Not in brief.md; must reach the Flow's stated requirements.
- [x] Corrections to the plan: binary is `brush_app.exe`; flag is `--total-steps`; Brush
      ships no NOTICE (LICENSE alone discharges Apache-2.0). **Anchors: brief.md was right
      about 6 floats** - `look_forward` takes 3 (`x,y,z`), `per_point_look` takes 6
      (`x,y,z,lookx,looky,lookz`); the shipped workflow uses both, so a coverage preset
      must carry its orientation with its anchor text.

## Phase 0b - the Wan-inclusive pass (the last unmeasured term)

fp8 first per plan.md amendment 7. Weights land in folders the bench already scans.

- [x] `wan_2.1_vae.safetensors` (0.25 GB) -> `C:/AI/vae`
- [x] `clip_vision_h.safetensors` (1.26 GB) -> bench `models/clip_vision`
- [x] `umt5_xxl_fp8_e4m3fn_scaled.safetensors` (6.74 GB) -> `C:/AI/text_encoders`
- [x] `wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors` (16.4 GB) -> `C:/AI/diffusion_models`
- [x] `lightx2v_T2V_14B_cfg_step_distill_v2_lora_rank64_bf16` already present at
      `C:/AI/loras/Wan/`; `4x-UltraSharp.pth` already on the bench.
- [x] **UNBLOCKED and used** - the 4-rail bake ran with the pano LoRA at 0.98
      (measurements.md § Phase 0b). The redistribution route below still stands for the
      shipped product: Matrix-3D is MIT, so convert and mirror to R2 rather than sending
      users at the gated repo.
      `pano_video_gen_720p.bin` (Matrix-3D pano LoRA, 0.61 GB) is in
      a **gated** HF repo. Fabio's token authenticates (403, not 401) but the account is
      not allow-listed: request access at `https://huggingface.co/Skywork/Matrix-3D`.
      **Matrix-3D is MIT**, so once fetched we convert with SplatKit's
      `tools/convert_pano_lora.py` and mirror the converted file to R2 - users never touch
      the gated repo. There is no substitute: without this LoRA, Wan emits ordinary
      perspective video, not equirect.
- [x] Ran `1_generate-dataset-hires.json` with Wan - **four rails, not one**: 2 h 18 m,
      912 registered cube faces, 28 911 `points3D`, 14 GB dataset. Wan sampling is 76 % of
      the cost. measurements.md § Phase 0b.
- [x] Tier ladder re-checked against the Wan dataset (one run, `--export-every 5000`).
      Draft 5 000 / Scene 30 000 stand; the Scene tier is 1 641 469 splats / 387 MB.

## Phase 1 - Scene card as an image card carrying a `.ply` (2026-08-29)

Delivered per plan.md amendments 18-20. `'splat'` is NOT a media type.

- [x] Sweep classified: ~50 media-type branches, **0 needed changing** - all correct for
      `type: 'image'` already. `createImageItem` gained `splatPath: null`.
- [x] `DERIVATIVE_RE` -> `thumb|proxy|splat`, so delete + the pass-2 orphan GC cover the
      `.ply` with no new cleanup code. `DERIVATIVE_RE` and `removeItemThumbs` exported
      for the test.
- [x] `add-from-cards` copies the `.ply` and rewrites `splatPath` at the destination -
      without it the copy points back into the source project and reads as valid.
- [x] `open-group` intercepted on `splatPath` in `MpiGalleryBlock.js` (placeholder toast
      until Phase 3's `PAGE_SCENE`).
- [x] `tests/splat-companion.test.cjs`, 4 tests. **791/791 `npm test`; lint clean.**
- [x] The `add-from-cards` test EXECUTES the route (2026-08-29). Was a source-text
      `assert.match` over the route body; now mounts the router on `app.listen(0)`,
      POSTs a real Scene card between two temp project dirs and reads the destination
      sidecar back. Proven red both ways by mutation: drop the rewrite -> "must name
      the DESTINATION companion"; drop the `delete` -> "must leave no URL behind".
      **793/793 `npm test`; lint clean; `routes/projects.js` restored byte-identical.**
- [ ] **User check in the running app** - the `user-ux` half of Phase 1's verification.
      Deferred into Phase 2 by Fabio; do not tick until a real Scene card exists.

## Parallel Batch - Bake path (2026-08-29)

- [x] **Task 1: `MpiBrushTrain` AUTHORED AND BENCH-VERIFIED (2026-08-29).**
      `c:\AI\Mpi\ComfyUi-MpiNodes\splat.py` + `__init__.py` (3 places) + README +
      changelog (V1.2.8) + `sha256_file` in `help_funcs.py` + `bin/` gitignored.
      Followed that repo's own `new-node.md` inline. Committed there as `5e07043`.
      Every CLI flag verified against `brush_app.exe --help`; two bugs caught and fixed
      (`BaseException` cancel, non-unique export dir) - plan.md amendment 22.
      **No-GPU proof:** `check_splat.py` in the pack, 12 assertions, all passing under
      the ComfyUI portable python.
      **Bench run PASSED** - `MpiBrushTrain` -> `PreviewAny` on 8188, `dataset_path` the
      raw Phase 0 dataset, `brush_path` the extracted binary (no download). 2000 steps in
      **23 s**, `export_2000.ply` 2.4 MB returned as `ply_path`. All three unproven
      assumptions held - amendment 24.
- [x] **Rail-scaling check (queued from Phase 0b) - DONE, and it corrects amendment 15.**
      Room extent measured from the MoGe cloud (radius p90 2.77); the shipped rails reach
      2.95 / 2.60, so they do leave the room - but scaling them x0.5 STILL split SfM into
      2 models. A shared `look_at_target` merges it: one model, 912 images. plan.md
      amendments 25-26. Phase 2's presets must carry a converging look target.
- [ ] **Task 2: dependency declarations** - untouched. Uploads multi-GB weights to R2;
      needs Fabio.
- [ ] **Task 3: pin the MpiNodes commit** - blocked, runs after 1 and 2.
- [x] ~~Decision for Fabio: registry exposure.~~ **Not a real question** - the registry
      has been unstuck for a long time and is on 1.2.x (Fabio, 2026-08-29). The two files
      in `ComfyUi-MpiNodes` that say otherwise are stale. plan.md amendment 23.

## Phase 2 - the 3D Scene Flow (2026-08-31 / 2026-09-01)

- [x] **Runtime graph BUILT and its injection surface proven.**
      `D:\WORK\MPI-623-spike\flow_3d_scene.api.json`, 51 -> 61 nodes, accepted with no
      `node_errors`, values set BY TITLE the way the app sets them. `MpiBrushTrain` is
      not an `output_node`, so it feeds a `PreviewAny` titled `Output_Splat` - the same
      text-capture shape the app already reads for `Output_prompt`. plan.md amendment 46.
- [x] **SfM + Brush tail PROVEN reading proxies off disk (2026-09-01).**
      `chunk8_sfm_brush_disk.json` from `make_sfm_disk.py`, dispatched standalone against
      the intact `mpi623_flowtest` bake - nothing re-baked. `success` in **30.5 min**;
      `/history` returned the `.ply` path through `Output_Splat`; **51.2 MB, 216,810
      splats, SH3**, dataset `mpi623_flowtest_sfm` with **984 images and ONE sparse
      model** under `on_split: stop`. **Peak ComfyUI working set 42.79 GB with only
      3.76 GB free** - a one-minute spike inside the SfM node, disk-fed or not. plan.md
      amendments 49 and 51 (51 corrects a wrong 8.59 GB figure in 49).
- [ ] **NAME THE SfM SPIKE BEFORE THIS FLOW SHIPS.** ~43 GB at one moment on a 68.5 GB
      box; a 32 GB user machine would not survive this scene. Suspect: the float32 chain
      over the 984 cube faces. Needs a bound or a documented RAM floor. plan.md 51.
- [x] **DECIDED (Fabio, 2026-09-01): TWO DISPATCHES.** One prompt cannot hold it -
      ComfyUI never evicts what the current prompt produced, and only a NEW prompt bumps
      the cache generation. plan.md amendments 48-49.
- [x] **Reference graph SPLIT and both halves validated.** `flow_3d_scene_a.api.json`
      (57 nodes: rails -> WAN -> composites -> `Output_Image`) and
      `flow_3d_scene_b.api.json` (14 nodes: proxies off disk -> SfM -> Brush ->
      `Output_Splat`), built by `make_flow_graphs_ab.py`, checked by `validate_graph.py`
      against the LIVE `/object_info`. A keeps all four composites because
      `HiResComposite` IS an `OUTPUT_NODE`; B drops all four hires manifests for
      `hires_dir` + `*.png`. Path plumbing proven on the bench (`test_pathwire.py`):
      164 files on both dirs, bake untouched. plan.md amendment 50.
- [x] **A -> B CHAIN BUILT (2026-09-01).** `flowService.js` runs a `chain: { operation }`
      flow as two ordinary jobs - leg 1, then leg 2 from leg 1's `onComplete`, ONE
      completion reported (on leg 2), leg 2 with no media and REUSING leg 1's `tempId`.
      `tests/flow-chain.test.cjs`, 7 tests, four executing the real `chainCallbacks`;
      860/860 on `npm test`, lint clean. **Q1 answered: a second OP, not a second
      `workflow` field on `FlowDef`. Q2 answered: job 1 owns the card, job 2 attaches
      `splatPath`.** plan.md amendment 52.
- [x] **THE PEER CLAIMS CLEARED (2026-09-01).** MPI-664's `db2037f3` is now
      `needs_verification` and MPI-591's `da9845c4` is `complete`; per
      `coordination-ops/statuses.md` only `claimed` means an active writer, so all seven
      files are free. The only live `claimed` record in the tree is MPI-591's
      `ComfyUi-MpiNodes/h3.py`. plan.md amendment 53.
- [x] **OUTPUT-CAPTURE LAYER DONE (2026-09-01).** `splatViewFileInfo` in
      `js/utils/comfyOutputUrls.js` + the `outputSplatNodeIds` title set, the `executed`
      branch and the `splatUrl` side-output in `commandExecutor.js`.
      `tests/flow-splat-capture.test.cjs`, 4 tests; all five mutations watched go red.
      864/864 on `npm test`, lint clean. Amendment 46's "small" held. plan.md amendment 53.
- [x] **THE INGEST HALF DONE (2026-09-01).** `splatViewUrl` threaded
      `generationService.onComplete` -> `projectService.saveGeneration` ->
      `/project/save-generation`, where a `streamDownload` beside the `audioViewUrl` mux
      writes `.meta/<id>.splat.ply` and stamps `meta.splatPath`. The route RETURNS
      `splatPath` and the live image item carries it, so a fresh Scene card opens without
      a reload. A failed fetch removes the stub and leaves `splatPath` ABSENT - never
      half-set. `tests/splat-companion.test.cjs` +5 tests (3 executing the real route
      against a stand-in `/view` server); **seven mutations watched go red**; 869/869 on
      `npm test`, lint clean. plan.md amendment 54.
- [ ] **`ComfyUI-SplatKit` is NOT in `dev_configs/node_lock.json`** - the pack every node
      in this card comes from is undeclared and exists only on the bench. Belongs with
      task 2 below. **(2026-10-05) Declared in `eb8efab0`, then taken OUT for 2.0 with
      Mickmumpitz too (`b3c25a678`, `edff37f2a`).** Re-add both entries by hand - never
      revert `edff37f2a` whole, it carries the engine-drift `to: null` fix - and ship the
      Brush binary as a pre-placed dep in `bin/brush-v0.3.0/` (MPI-800, MpiNodes 1.2.16).
- [ ] **GREEN-LIGHT EVIDENCE (Fabio, 2026-09-14): a FULL-tier result before any Vision
      wiring.** 2026-10-05: a fresh 30 000-step held-out bake of the swap157 dataset at
      `MpiBrushTrain`'s flags (`run_swap157_brush.py` -> `swap157_30k_out\`), sheets by
      `sheet_30k.py`. Ticks only on Fabio's verdict, not on the run finishing.
- [ ] Wire the Flow across the five registry files; coverage presets as scene-relative
      waypoints; per-waypoint bounds check (NOT a radius cap - amendment 43); dev-gate
      and tile still. See plan.md Phase 2.
- [ ] Author the graph on the ComfyUI canvas at `G:\ComfyUi` - `flow_3d_scene.api.json`
      is API-format and script-assembled, which the add-flow playbook forbids shipping.
      **Fabio's half.**

## Phase 4 - 360 Panorama Flow (promoted to FIRST, 2026-10-06)

- [x] LoRA licence: MIT, ungated (`huggingface.co/mickmumpitz/Krea2-360-ERP-LoRAs`).
- [x] Bench setup: both LoRAs in `G:\CubricModels\loras\krea-2\360\` (+ model card),
      `ostris/ComfyUI-Krea2-Ostris-Edit` @ `7756566` cloned, bench restarted.
- [x] Cartoon input made on the bench with Vision's Krea2 and shown to Fabio first; he
      picked the village.
- [x] Does the outpaint LoRA run on Vision's weights, and on which edit nodes? Ostris:
      yes. lbouaraba: no. Fast tier beats the Raw quality tier. validation.md § Phase 4.
- [x] 2K -> 8K on Vision's weights: shipped 4x-NMKD-Siax replaces RealESRGAN_x2; the tiled
      refine re-opens the wrap seam and a 128 px wrap pad fixes it (2.71 vs 2.66 baseline).
- [ ] Fabio judges the bench panos (seam, horizon, look) - `user-ux`.
- [ ] 3D Scene bake from the pano he picks (Phase 2 bench pipeline, ~3 h GPU - his yes).
- [ ] Wire the Flow via `/mpi-add-flow`: Ostris pack + Mickmumpitz nodes (re-add by hand),
      both LoRAs as deps, fast tier only, Siax 8K stage inside a wrap pad/crop.
- [x] Single-shot N-layer chain on a full low-poly 360 pano (`chain.py cross`, 8 steps, Klein
      inpaint per step, one combined .ply). validation.md § N-layer chain.
- [x] Fabio flies `chain_cross_all.ply` - `user-ux`. 2026-10-07: "1" (looks right); next = 8K pano first.
- [x] Same walk on an 8K pano (AnimeSharp 4x model-only, wrap pad; `chain8k.sh`). validation.md
      § Same walk on the 8K pano.
- [x] Fabio flies `chain_cross8k_all_4k.ply` - sharper, but the crossroads pano is unusable (row behind row).
- [x] Same pipeline on the open `ring` pano at 8K (`ring8k.sh`). validation.md § Open layout.
- [x] Fabio flies the ring - `user-ux`. 2026-10-07: flew `chain_ring8k_gen_user_all_4k.ply`, "1".
- [x] One style-free fill prompt (`GENERIC` + optional user line) on low-poly, 2D cartoon and
      photoreal (`prompt_test.sh`). validation.md § One style-free fill prompt.
- [x] Fabio judges the generic fill prompt on the three styles - `user-ux`. 2026-10-07: "1".
- [ ] Build user-line presets (Forest / More houses / Open fields + free text) WITH the Flow.

# MPI-623 validation

## Green-light evidence: full-tier held-out bake (2026-10-05)

Fabio's gate (2026-09-14): no Vision wiring until he has seen a finished-tier result.
Draft (5 000) renders were rejected as not product quality.

**Run.** Brush v0.3.0, 30 000 steps on the staged swap157 root
(`D:\WORK\Images\Outputs\mpi623_swap157_brush`, 984 views: Q4_K_M Wan, rails
27/122/133/157), `MpiBrushTrain`'s flags (`--sh-degree 3 --max-splats 10000000
--max-resolution 2048`) plus `--eval-split-every 8 --eval-every 15000
--eval-save-to-disk`. Under the GPU lease, Fabio's yes on the GPU.
Script `D:\WORK\MPI-623-spike\run_swap157_brush.py`, log `swap157_30k_run.log`.

- **48.1 min** on the 4060 Ti; `swap157_30k_30000.ply` **380 MB**; 123 held-out renders at
  15 000 and at 30 000 (`swap157_30k_out\eval_*`).
- Peak `brush_app.exe` working set **7.6 GB** (sampled every 10 s), under the ~11.5 GB the
  `max_resolution` comment in `splat.py` estimates for 984 views at 2048 - this run trains
  on 861. Peak total GPU memory **5.9 GB** (incl. ~1.1 GB desktop).
- Held-out PSNR vs ground truth (render upscaled to the 2048 original), `sheet_30k.py`:

| | mean | rail 27 f0/f2 | rail 122 f0/f2 | rail 133 f0/f2 | rail 157 f0/f2 |
|---|---|---|---|---|---|
| Draft 5 000 (amendment 42, max-res 1920) | 28.88 | 29.28 / 26.62 | 25.82 / 21.90 | 28.24 / 25.19 | 27.40 / 26.68 |
| 15 000 | 31.12 | 32.95 / 28.43 | 28.28 / 22.62 | 31.77 / 26.53 | 29.57 / 28.18 |
| **30 000** | **32.28** | 34.06 / 29.49 | 28.70 / 23.70 | 32.80 / 28.50 | 30.46 / 28.81 |

  The scorer reproduces amendment 42's Draft table to 0.01 dB, so it is the same metric.
  Every rail/face cell rises from Draft to 30 000.

**By eye (sheets in `D:\WORK\MPI-623-spike\3d-scene-30k-deliverables\`).** Wide views match
truth closely; rail 157's graffiti wall at full resolution is near-identical. Failure modes:
objects close to the camera (the arcade cabinet) ghost and smear, floor debris softens,
fine plaster grain smooths away, and rail 122 owns all four worst views - one pose sits
against a wall and renders as fog. Against the Wan-free control (different reconstruction,
paired by ground-truth content, scores not comparable across the two), Wan removes the
black-rimmed disocclusion holes and keeps near objects sharper.

This run holds 1 view in 8 back; the product node trains on all of them.

**Verdict (Fabio, 2026-10-06): NO green light yet - the test scene is the problem.** The
rubble-and-graffiti room is hard to read even in the ground truth, so it is a poor quality
benchmark (it was only ever Phase 0's free CC0 8K pano). Realism (a living room, a bedroom)
is doubtful on this evidence; a 3D or 2D cartoon world may suit the pipeline well.

## `max_resolution` 2048 vs 1920 (2026-10-05, Fabio's yes)

Same swap157 root, 5 000 steps, identical flags and seed (42) except `--max-resolution
2048`, against amendment 42's 1920 run - so the 123 held-out views are the same.
`run_swap157_brush.py` -> `swap157_5k_2048_out\`, scored by `maxres_check.py`
(`maxres_check_result.txt`): each render against the 2048 original (1920 upscaled), and
again with everything downscaled to 1920.

- 6.0 min (1920 run: 6.3), 52.1 MB `.ply` (52.2), peak RAM 7.5 GB, GPU 3.5 GB.
- **No measurable gain at Draft.** Face 0 27.72 -> 27.72, face 2 25.02 -> 24.93, face 4
  33.89 -> 33.44; all 123: 28.88 -> 28.69 (-0.19 dB); 2048 wins 55/123. Both scorings
  agree to 0.01 dB, so this is not a resolution artefact of the metric.
- **Untested:** whether 2048 pays at the full tier, where the splat can resolve finer
  detail - that needs a ~48 min 1920 bake against `swap157_30k_out`.
- The `splat.py` comment's ~11.5 GB for 984 views at 2048 is not what Brush holds:
  measured 7.5-7.6 GB working set at 2048 (861 training views).

**Decision (Fabio, 2026-10-05):** keep the 2048 default; the full-tier test is skipped.

## Phase 4 bench test: 360 panos on Vision's Krea2 weights (2026-10-06)

Fabio's yes (2026-10-06): both 360 LoRAs, the Ostris clone + bench restart, ~1 h GPU for
4-6 runs, the agent making the cartoon input. Every run under the GPU lease, asserted on
the output files. Scripts and logs in `D:\WORK\MPI-623-spike\cartoon\`; outputs in
`D:\WORK\Images\Outputs\mpi623_pano\`; sheets in `cartoon\sheets\`.

**Setup.** LoRAs (MIT, ai-toolkit; outpaint 0.12.8 / 10 500 steps, t2i 0.10.29 / 2 500)
in `G:\CubricModels\loras\krea-2\360\` with the HF model card as `README.md`.
`ostris/ComfyUI-Krea2-Ostris-Edit` @ `7756566` in the bench `custom_nodes`. Graphs mirror
`research/pano.json` node for node with three swaps: Raw int8 (+ `krea2_turbo_distill_r128`
@1.0 = fast tier, none = quality tier) for the deleted Turbo transformer, the abliterated
Qwen3-VL encoder, `qwen_image_vae` for `wan_2.1_vae`.

**Input** (Fabio picked the village over a forest): `village_00001_.png`, 1344x768, Krea2
fast tier, 26 s. Deviation: its stage 2 took ClownsharK's `denoised` output, Vision's
graph takes `output`. Placed at h_fov 70, yaw 0, pitch 0 (pano.json defaults).

**Seam ratio** = mean |col 0 - col W-1| / median mean |col i - col i+1|; 1.0 = the wrap
edge reads like any neighbouring column pair. `pano_sheet.py`.

| run | nodes | tier | wall clock | peak GPU mem | seam raw -> final | verdict |
|---|---|---|---|---|---|---|
| `ostris_fast` | Ostris (`kv_cache` on, as pano.json) | fast | 211 s (cold) | 15.6 GB | 2.53 -> 0.79 | **works** |
| `lb_fast` | Vision's lbouaraba patch + grounded encode | fast | 399 s, interrupted in the seam pass (loaders cached) | | n/a | **fails** |
| `t2i_fast` | text->360, `krea2_t2i_360_erp_lora_v1` @1.0, trigger `img-txt-2-360` | fast | 96 s | 15.4 GB | 1.48 -> 0.74 | **works** |
| `ostris_quality` | Ostris; Raw, ClownsharK euler/beta 25 @cfg 2 (seam: euler/beta 25 @cfg 2) | quality | 597 s | 15.8 GB | 4.16 -> 1.05 | works, **worse** |

- **`ostris_fast`:** a full cartoon pano, level horizon in all four 90-degree views,
  no visible seam, style held all the way round. The outpaint REPEATS the village behind
  the camera (a second copy of the cottages and well at yaw ~270).
- **`lb_fast`:** the open question, answered NO. Same LoRA, same sampler, reference on
  Vision's `Krea2EditModelPatch` + `Krea2EditGroundedEncode`: it fills nothing - the green
  comes back as green/grey noise and the village re-renders with a red cast. **The Ostris
  pack is required** (MIT, one `nodes.py`, no extra deps). It is also >2x slower: 399 s
  with every loader cached and still not through the seam pass, so the agent interrupted
  it (the raw outpaint had already answered the question). No quality-tier lbouaraba run
  was spent.
- **`t2i_fast`:** a cartoon village square round a well, cottages wrapping both sides,
  hills and trees behind; level horizon in all four views, no visible seam. The turbo-distill
  LoRA stacks with the t2i 360 LoRA without trouble. Prompt: `run_pano.py` `T2I_PROMPT`.
- **`ostris_quality`:** the Raw tier without the accelerator is WORSE and 2.8x slower: the
  fill drifts to a washed-out painterly look (pink sky, soft rock outcrops, half-ruined
  buildings) that no longer matches the clean cartoon input, and the raw seam is the worst
  of the set. pano.json runs on Turbo, so the LoRA most likely learned on Turbo; Raw +
  turbo-distill reconstructs that. **The Flow should run the fast tier only - no quality
  toggle.**

**2K -> 8K (pano.json stage ⑤, `run_upscale.py`, `upscale_sheet.py`).** Source:
`ostris_fast`. Both branches in one graph, 416 s: upscaler -> lanczos to 8192x4096 ->
`ImageAddNoise` 0.01 -> `UltimateSDUpscaleNoUpscale` (Raw + turbo-distill, 1024 tiles,
2 steps er_sde/simple @0.15, cfg 1). `ImageCASharpening+` skipped (ComfyUI_essentials is
not on the bench). Sheet: `sheets\sheet_ostris_fast_8k_upscalers.png` (1:1 crops).

| 8K branch | wrap seam ratio | look |
|---|---|---|
| plain lanczos x4 of the seamless 2K (baseline) | 2.66 | soft, no seam |
| RealESRGAN_x2 + refine (pano.json) | 4.64 | clean, smoother; **visible seam** |
| 4x-NMKD-Siax + refine (Vision ships it) | 3.47 | crisper lines, finer texture; **visible seam** |

At 8K the ratio has a higher floor (neighbouring columns sit 4x closer), so compare against
the baseline, not 1.0. **Siax is at least as good - substitute it, RealESRGAN_x2 is not
needed.** **But the tiled refine RE-OPENS the wrap seam** - USDU tiles do not wrap, so the
two edges are refined apart and a vertical cut shows through the tree at yaw 180.

**FIXED by wrap-padding (run 6, `run_upscale.py ostris_fast 128`, 239 s):** pad the 2K pano
with 128 px of its own opposite edges (2304x1024), Siax 4x + the same refine at 9216x4096
(9x4 tiles), crop 512 px off each side. **Seam ratio 2.71 against the 2.66 baseline**, and
the tree at yaw 180 is continuous by eye (`sheets\seam_8k_siax_wrap_crop.png`). The Flow
needs this pad/crop around its 8K stage (core `ImageCrop` + a stitch can do it). The 8K
file: `ostris_fast_8k_siax4x_wrap_00001__cropped.png`.

**GPU spent:** six bench runs, ~38 min, plus the two cartoon inputs (~1 min), inside the
~1 h Fabio approved.

**Fabio's own tests in the app (2026-10-06, project `3D pano tests`, input = `ostris_fast`
final, sha-identical):** model-only x4 upscales `imageUpscale_002` (Siax) and
`imageUpscale_003` (AnimeSharp); 2K `detail` with a circle mask: `detail_003` Klein 9B @0.30,
`detail_004` Krea @0.30, `detail_005` Krea @0.15.
- **Verdict (Fabio): 4x-AnimeSharp is the better upscaler for this style.** Vision already
  ships it (`assetDeps.js`, the anime models' `defaultUpscale`).
- **Model-only upscales keep the wrap seam clean** (agent check, no GPU): Siax 1.30,
  AnimeSharp 1.97, both under the 2.66 lanczos baseline, trunk continuous by eye
  (`sheets\seam_8k_animesharp_only_crop.png`). This settles the earlier caveat: the 8K seam
  came from the tiled REFINE, not the upscaler.
- A circle mask on the detail op hides the detailed-area boundary (Fabio).

**DEFECT, found by Fabio, missed by the agent: the tiled Krea refine GHOSTS houses and trees
into the SKY.** Both refined 8Ks (`..._8k_siax4x_wrap_..._cropped.png`,
`..._8k_esrgan2x_...png`) carry faint villages across the upper band; the 2K final,
AnimeSharp-only and Siax-only skies are clean (`sky_check.py` ->
`sheets\sky_ghost_check.png`). Cause: the documented per-tile prompt trap
(`docs/models/krea2/upscaling.md` § Traps) - every 1024 tile is sampled with the full scene
prompt ("...a cosy village in a forest..."), so flat sky tiles draw the scene at 0.15. The
agent missed it because every 1:1 crop it checked was village, ground or seam, never sky.
**Consequence:** the refined 8Ks are unusable; the bake input stays the AnimeSharp-only 8K.
Any tiled refine needs an empty or generic prompt (or per-tile prompts). Fabio is testing
his "super upscaler" workflow as the alternative (2026-10-06).

## Super upscaler (Fabio's `flow_super_detailer`, bench, 2026-10-06)

Impact Pack's Make-Tile-SEGS demo (its notes describe a **2x** step, 1024x1536 -> 2048x3072):
AnimeSharp 4x -> `ImpactMakeTileSEGS` (1024, crop 1.5, overlap 200, irregular masks) ->
`DetailerForEachDebugPipe` on `ILL_Anime` (SDXL), lcm 8 steps cfg 1.5, **denoise 0.46**,
wildcard "2D flat shader, cartoon"; person split present but the character pass bypassed.
761 s for 2K -> 8K in one jump. Copies + scripts: `D:\WORK\MPI-623-spike\cartoon\superdetail\`.

- **Far crisper than any model-only upscale** (Fabio's screenshots), but **tile colour
  blocks** (grass, a vertical band in the sky) and a global palette drift (sky cyan, stones
  pink). Measured against the base at 64 px scale: drift mean 15.6, max 93 (0-255).
- **It redraws content, not just colour**: at 0.46 with a 1024 tile seeing ~1/32 of the pano,
  background trees change species and a house becomes rocks (`sheet_colour_lock_crops.png`).
- **Input was `ostris_fast_raw` (pre-seam, wrap seam 2.53)** - a pano run must take
  `ostris_fast_final`, and the tiles need the 128 px (at 2K) wrap pad like the Siax refine.
- **Colour lock REJECTED (no GPU, `colour_lock.py`)**: out = D - LP(D) + LP(B) at f 8/16/32
  drops drift to 0.5-0.9 and keeps detail (hf 3.9 vs 3.9 detailed, 2.5 base), but leaves
  halos round every outline and doubled edges wherever the detailer moved a shape. Numbers
  passed, eyes failed. Only viable once the detailer keeps the geometry.
- Levers left: two 2x passes (Fabio's idea; the notes' own design), lower denoise on the 8K
  pass, the bench's `ControlNet-Union-ProMax-SDXL` in tile mode per SEG
  (`ImpactControlNetApplySEGS`), Klein 9B as the detailer. **Fabio is testing Klein 9B on a
  lanczos 2x at denoise 0.3 himself first; the agent's 3-run test (~45 min) waits for his
  handover.**

**Fabio's Klein recipe (his eye: 0.35 right, 0.45 changes too much; an 8K detail pass is
overkill):** `ostris_fast_final` -> lanczos 2x (4K) -> the same tiles -> Klein 9B int8
(`flux-2-klein-9b-int8-convrot`, `qwen_3_8b_int8_convrot`, `flux2-vae`) in the Detailer,
4 steps lcm/normal cfg 1, **denoise 0.35** -> AnimeSharp 4x -> 8192x4096. Keeps the content
(houses, well, stones) and the palette. Agent runs as one API graph,
`superdetail\run_superdetail.py`, outputs `D:\WORK\Images\Outputs\mpi623_superdetail\`:

| 4K detail pass | wrap seam (lanczos base) | drift mean / max | wall clock |
|---|---|---|---|
| ILL 0.46, 8K one jump (Fabio, before) | 15.03 @8K (2.66) | 15.5 / 93 | 761 s |
| Klein 0.35, no pad (Fabio) | 3.91 (1.38) | 5.6 / 44 | 322 s |
| + wrap pad 128 @2K | 3.08 (1.38) | 5.8 / 36 | 440 s cold |
| **+ pad 128 + 256 px cross-fade** | **0.83** (1.38); 8K **1.08** (2.66) | 5.8 / 36 | 80 s warm |

- Klein drifts 3x less than ILL and its drift map shows NO tile grid (only where lines were
  added). No inner column/row seams; a few garbage rows at the very bottom (nadir) remain.
- **The pad alone reconnects the lines but leaves a TONAL step** (each side is its own
  render). **The cross-fade fixes it**: the right pad (rendered beside col W-1) fades into
  the core's first 256 columns via KJNodes `CreateGradientMask` (`frames` must be 1 - 0
  returns an empty batch) + core `ImageCompositeMasked`, then `ImageStitch`. No new node.
  Seam close-ups at 1:1: `superdetail\sheet_seam_xf.png` - no seam, no visible double lines.
- **Fabio still saw a seam in flat sky** - correctly; the whole-height ratio hides it under
  the village rows. Measured on sky rows only (`sky_seam.py`): **the SOURCE 2K already
  carries it** (2.16x the column median at the wrap, tone -2/-3/-4 RGB, a thin LIGHT streak
  by eye, `sheet_sky_boost.png`). Root cause: the 360 Flow's own seam stage is img2img at
  **0.45** (pano.json: 96 px strip, feather 24, euler/simple 10, cfg 4), and img2img at that
  denoise keeps low-frequency tone. pad+xf carries it unchanged (-3.4/-2.6/-3.2).
- Tried on the upscaler side, all on the pad+xf 4K: a Klein seam re-detail
  (`run_seampass.py`: `MickmumpitzPanoSeamRoll` 6% strip -> `MaskToSEGS` ->
  `ImpactMakeTileSEGS` filter_in, which ANDs tile masks with the strip) at **0.5 - no
  change** (the same 0.45 trap), at **0.75 - REJECTED by eye**: the wrap metric went clean
  (0.7x, tone ~0) but the strip came out a visible band (dark sky block, a red mushroom cap
  grown out of a tree, a green band on the ground). On the unpadded 4K the 0.5 pass left the
  tile seam too (6.2x). A deterministic tone level (`seam_level.py`, per-row excess step
  over the local slope, median along y, faded out over 256 px) halves the step
  (-1.9/-0.8/-1.3) with no damage, but a ridge is not a step and the streak stays faint.
  A first version measured the step over 16 px and picked up CONTENT (|J| max 52 RGB), making
  the wrap worse (3.45x) - the excess-over-slope estimate is what fixed that.
- **Where the fix belongs: the 360 Flow's seam stage, at 2K, before any upscale** - not the
  upscaler. GPU spent this block: ~15.5 min (440 + 80 + 130 + 140 + 140 s).

### Source seam re-run (2026-10-06, `cartoon\run_seamfix.py`, 160 px strip / feather 32)

Only the seam stage, on the saved `ostris_fast_preseam` + `canvas` (copied into bench `input/`
as `mpi623_seamfix_*.png`), same Ostris model/cond chain, seed 12345. Sky luminance profile
across the wrap (8 px bins, `scratchpad sky_profile.py` logic) is the measure that told them
apart; `sky_seam.py`'s 8-col step alone misreads a ridge as a step.

- **Correction: the preseam has NO sky tone step** (-0.4/-0.2/-0.7, profile 189.5 | 189.1),
  only a hard 1-column line. **The 0.45 seam pass CREATES the streak**: a +5 light ridge
  16 px wide just left of the wrap (192.9, 194.4 vs ~190). Img2img at 0.45 keeps the hard
  edge's trace and turns it into a ridge - not "keeps an inherited step".
- euler/cfg 4 (pano.json's image seam sampler) @0.6: ridge gone, but mottled flat sky in the
  strip and the redrawn tree's right edge ghosts over the old orange one (feather blend).
- **er_sde/cfg 1 (pano.json's t2i seam sampler) @0.6: best.** Sky flat across the wrap
  (188.4 | 188.2), wrap diff 0.82x median (0.45: 2.16x), step < 1 RGB, orange tree intact.
  Left: faint checker mottle in the upper flat sky (visible at 2x), one new grass plant +
  a leaf whose stem fades at the strip edge.
- @0.7, both samplers: REJECTED - whole strip +10-12 brighter, a cloud and a half-house
  with hard edges where the strip ends (same failure as Klein 0.75).
- er_sde @0.6 with 20 steps: mottle WORSE (blocky dashes, a diagonal edge) - not residual
  noise from 6 effective steps.
- Sheets: `superdetail\sheet_srcseam_fabio_sky.png` / `_village.png` (2x, wrap centred).
  GPU this block: 280 + 133 + 124 s = ~9 min; ~24.5 of Fabio's 45 spent.
- **Fabio: keep 0.45** ("usually the best": it changes least) and opened the GPU freely.
  So the edge, not the denoise: `cartoon\wrap_soften.py` blurs the 2K preseam across the
  wrap only (horizontal Gaussian, smoothstep blend to 0 at +-R; asserts the pano centre is
  byte-identical), then the ORIGINAL seam pass (96/24, euler cfg 4, 10, 0.45) via
  `PRESEAM=<x> run_seamfix.py 96 24 euler 4.0 10 0.45`.
- Control (unsoftened, same graph) reproduces `ostris_fast_final` (mean |diff| 0.61/255,
  1.7 in the wrap strip) and its ridge (+2.5-3), so the graph is the Flow's.
- **soft12 (sigma 12, R 48): ridge gone**, sky flat in the boosted view; the strip reads
  3-4 darker over ~64 px in the profile, invisible by eye. Trade: the cloud that ends at the
  wrap now fades into a blue gap instead of being joined. soft6 (sigma 6, R 24) leaves a
  hard vertical cut through that cloud - soft12 preferred. Village: only flowers change.
  Sheets `superdetail\sheet_soft_sky.png` / `_village.png` / `_sky_boost.png`. ~6.6 GPU min.
- **Fabio REJECTED soft6/soft12 by eye: "messed up a cloud"** - his 0.45 joins the cloud
  the wrap cuts; a blurred cloud edge comes back as a fade. Village crops: he could not find
  the seam in any variant (it is a sky-only problem). The soft12 re-upscale was interrupted.
- **Flat-sky-only soften (`wrap_soften.py <in> <out> 12 48 6`) - the candidate.** Blur only
  where it changes a sigma-2-smoothed copy by < 3 levels (ramp to 0 at 6), mask eroded 8 px
  and softened: judged raw, the paper texture moves 2-3 under any blur and the mask came out
  EMPTY; pre-smoothed, sky p90 is 1.3-2.2 vs 14-46 on cloud/tree rows. Cloud rows change
  <= 1 level, sky rows <= 5. Then the unchanged 0.45 pass: **ridge gone** (wrap diff 2.16x
  -> 0.94x median, profile 190.9 190.6 | 189.3 187.0 = a gentle slope), **cloud joined
  exactly as in his 0.45**, village composition unchanged (pink flower kept).
  Output `mpi623_pano\ostris_fast_seam045w96_flat12t6_00001_.png`; sheets
  `superdetail\sheet_flat_sky.png` / `_village.png` / `_sky_boost.png`. **Fabio, 2026-10-06:
  "the sky is now spot on. The village as well."** - the 360 seam fix for the Flow.
- **Re-upscaled** (`run_superdetail.py 128 0.35 xf mpi623_pano_flatsky_final.png flatsky`,
  451 s cold; the input is now an argv): `mpi623_superdetail\klein035_pad128_xf_flatsky_4k_
  00001_.png` (8.8 MB) and **`..._flatsky_8k_00001_.png` (31 MB, 8192x4096) = the bake
  input.** Flat-sky wrap vs the old pad+xf: 4K line 2.39x -> 1.14x median, tone step
  -3.4/-2.6/-3.2 -> -1.4/-0.4/-0.2, ridge gone in the profile; 8K tone step -2.2 -> -0.2,
  line 1.1-1.2 levels of 255 (a column's median 0.5; old 1.97). By eye at 1:1 no seam in
  sky, trees or ground at 4K or 8K (`superdetail\sheet_flatsky_seam.png`); at x4.7 contrast
  only a hairline, the old light band gone (`sheet_flatsky_8k_sky_boost.png`).
- GPU this session ~28.5 min (seam 0.6/0.7 x2 + s20 9 min, soften x3 6.6, interrupted soft12
  upscale ~3, flat 2.5, 8K 7.5) - ~44 in all against Fabio's 45, then he opened the GPU.

### Cross-fade GHOSTING (Fabio caught it, 2026-10-06) -> cut merge

- **Fabio on `sheet_flatsky_seam.png`: the middle (trees) crops "have ghosting ... like
  overlapping images", and the ground crop shows a slight seam.** Correct; the agent had
  passed it. Traced by cropping one patch through every stage (`stages_trees.png`,
  `stages_ground.png`): absent at 2K, faint at 4K, crisp at 8K - the 256 px **cross-fade**
  (xf) blends two Klein renders of the same strip; where Klein drew a line a few px apart,
  both show at half strength, and AnimeSharp sharpens them into a double outline (chimney,
  canopy, roof edge). The ground "seam" is the same ghost (a broken grass-edge line ~50 px
  right of the wrap, inside the xf zone). The validation.md claim above that the xf sheet
  showed "no visible double lines" was wrong - it was judged at 4K, where the ghost is soft.
- `seam_level.py` at 2K on the stone: no visible change (the stone's dark crescent is its
  shading) - dropped.
- **Fix: `superdetail\wrap_cut.py <padded.png> <out_4k.png> 128`** on the raw padded Klein
  render (`run_superdetail.py ... xf` now also saves it as `*_padded`): low-frequency tone
  LP(R)-LP(C) (sigma 32) ramped across the 256 px overlap, then each row takes R left of a
  min-cost top-to-bottom cut through the dilated |R'-C'| and C right of it, 2 px feather.
  Cut stayed 32..147 px into the overlap. CPU, 4 s.
- **8K via `superdetail\run_animesharp.py <src> <tag> 32`**: AnimeSharp is now wrap-padded
  too (32 px at 4K), which removed the 8K hairline (wrap col diff 0.34-0.48 vs median 0.49;
  was 1.1-1.2). 80 s.
- Result `mpi623_superdetail\flatsky_cut_8k_00001_.png`: sky wrap <= 0.97x median at 8K (xf:
  2.46x); by eye single outlines on chimney/canopy/trees, one continuous grass edge
  (`sheet_cut_seam.png`, xf top, cut bottom). Left: two few-px jogs where the cut must cross
  a line (grass edge, one stone outline). **Fabio, 2026-10-06: "bottom ones are
  acceptable" - this is the bake input**, staged as `G:\ComfyUi\ComfyUI\input\
  mpi623_bake_village_8k.png` (byte-identical copy).
- **Fabio's "Flow Tile Detailer"** (he named it): `G:\ComfyUi\ComfyUI\user\default\workflows\
  flow_tile_detailer.json`, built by `superdetail\make_tile_detailer_wf.py` from his
  `flow_super_detailer.json` (left byte-identical): + the 360 wrap pad (2 ImageCrop + 2
  ImageStitch on link 73, an ImageCrop after the Background detailer), a read-me Note and
  group, LoadImage on the approved 2K. Pad only - no xf (ghosts), no cut (needs a node).
  Link consistency asserted in the script; NOT yet opened in the ComfyUI UI.

## Village 3D Scene bake + GO/NO-GO trim test (2026-10-06/07, `D:\WORK\MPI-623-spike\village_bake\`)

- **MoGe waypoint check FAILED rails 122/133** (into the near trees); scaled x0.55 / x0.70
  about the origin (`moge_check.py`, `scale_search.py`). Wan prompt rewritten for the village.
- **Bake** (`run_bake.py`, graphs A then B, 30000 steps, lease): 23:57 -> 03:20, 3 h 23 min.
  `splats\mpi623_village_bake_whuos8uv\export_30000.ply` 286 MB, ONE model, 984 images.
- **Fabio caught an S-tree and a broken well in the Wan frames.** `frame_clearance.py`: manifest
  poses are y-DOWN, the cloud y-UP. Bad frames = the rail tails under canopies / over the well.
- **Held-out eval, untrimmed** (`run_eval_brush.py`, 43 min, 123 views): mean 25.88 dB; typical
  views clean on every rail; the worst views ARE the bad tails (rail 122 f70-f80 near-trunk smear
  19.4-22.9 dB, rail 27 f80 well rim 21.7). `sheets_untrimmed\`.
- **Trim test** (`run_trim.py`; drop clearance < 0.22 OR coverage < 0.60 = 22 of 164 frames:
  27 f72-80, 122 f64-80, 133 f24-38): SfM 17.5 min (one model, 852 images) + held-out Brush
  41 min, 107 views, mean 26.09 dB. **Worst trimmed view 23.0 dB and readable** (soft near-trunk
  edges), no S-tree, no broken well (`sheets_trim\trim_worst4.jpg`).
- Same-pose (27 poses, rail 27 only - the renumbering misaligns the rest): -0.18 dB, invisible
  by eye (`cmp_loss.jpg`). **Trimming does not improve kept views; it removes the bad ones** -
  the damage was local, not polluting neighbours.
- Not tested: free navigation OFF the rails (Brush renders only training poses). That is
  Fabio's eye-test on `eval_trim_out\village_trim_30k_30000.ply`. GPU tonight: ~5 h local.

## Single-shot warp-and-inpaint, no bake (2026-10-07, `D:\WORK\MPI-623-spike\single_shot\`)

- Base renders straight from the 8K pano (`run_render.py`, SplatKit perspective node, `cut`):
  4 shots in 150 s on the 4060 Ti; 2 more in 20 s (depth cached in the bench process).
- Fill sweep on B_deep (24% holes) and C_front (15%) with the app's own graphs
  (`run_fill.py`), seed 42: **Klein 9B inpaint wins** - drift on known pixels 0.7-0.8/255,
  30-40 s a shot at 1920x1088. Klein edit fills but drifts 9-11 (Reinhard fixes colour).
  Krea2 edit AND masked edit leave the holes black, 6-8 min a job. Qwen not installed.
- Pano splat with holes for Fabio's own look: `village_pano_holes_2k.ply` (2,027,034
  splats, 108 MB, 70,118 edge pixels cut; ground at y +0.39, y-DOWN) - `pano_splat.py`.
- **Reuse check (`reuse.py`):** own renderer reproduces the node's frames (mean abs
  0.42/255, hole masks 100% identical on all 3 cameras). C_front's Klein fill lifted to 3D
  with MoGe depth fitted on known pixels (z = 0.7789*moge + 0.0973, median rel err 4.1%).
  | step | holes, pano only | holes with shot 1's fill | reused | fill in front of pano |
  |---|---|---|---|---|
  | C_step1 (0.1 right) | 16.0% | 4.5% | 72% | 0.58% px |
  | C_step2 (0.2 right) | 17.9% | 7.8% | 57% | 0.63% px |
  By eye (`reuse_sheet.jpg`): shot 1's invented side wall + window, bush and trees carry
  into both steps; Klein then fills only silhouette slivers. Klein from scratch invents a
  DIFFERENT wall and trees each time. Weak spots: a few small pale rectangular seams where
  the lifted fill's edge meets the pano; the reused fill is a touch softer.

## N-layer chain on a full low-poly pano (2026-10-07, `chain.py cross`)

- Pano `t2i_fast_cross` (low-poly crossroads, content on every side), 2K, MoGe valid 0.758.
- 8 steps up the lane and back toward the square, 1280x720, 24 mm. Each step: render pano + all
  earlier fills, Klein 9B inpaint (seed 42) on the still-black pixels, MoGe lift as a new layer.
  Look-at cameras asserted equal to SplatKit's C_front camera (atol 1e-3). Rerun gave identical numbers.

  | step | holes, pano only | holes after earlier fills | reused | depth fit rel err |
  |---|---|---|---|---|
  | 0 | 21.6% | 21.6% | - | 4.0% |
  | 1 | 33.8% | 19.6% | 42% | 3.5% |
  | 2 | 19.6% | 15.6% | 20% | 6.7% |
  | 3 | 16.3% | 6.2% | 62% | 7.5% |
  | 4 | 53.8% | 53.8% | 0% (new view) | 10.2% |
  | 5 | 55.1% | 24.9% | 55% | 13.4% |
  | 6 | 12.2% | 6.2% | 49% | 2.7% |
  | 7 | 19.9% | 13.9% | 30% | 3.0% |

- `chain_cross_all.ply`: 3,520,004 splats (2,004,219 pano + 1,515,785 fill), 187 MB; `ply_check.py`:
  byte size matches the header, all values finite, fill xyz inside the scene bounds.
- By eye (`chain_cross_sheet.jpg`): step 4's invented cottage + stall reappear in step 5 from a new
  angle. Weak: step 4 invented a second well, softer 2K pano next to sharp fills, haze patches.
- **Fabio flew `chain_cross_all.ply`: "1"**, then asked for the pano at 8K first.

### Same walk on the 8K pano (2026-10-07, `chain8k.sh`)

- 2K -> 8K: AnimeSharp 4x, model-only, 32 px wrap pad, 25 s; wrap col diff 2.04 vs median 1.18
  (1.73x; the earlier AnimeSharp-only 8K was 1.97x against a 2.66x lanczos baseline); no seam by eye.
- Same depth and cameras, so hole % are identical per step; reuse 25-61% (2K run 20-62%); depth
  fit at step 4 improved 10.2% -> 5.1% (Klein drew more consistent geometry from a sharp input).
- `chain_cross8k_all_4k.ply`: 9,652,678 splats (8,139,002 pano on a 4096 grid + 1,513,676 fill),
  515 MB; `ply_check.py` passed. Lite: `chain_cross8k_all_2k.ply` 3,517,895 splats, 187 MB.
- By eye (`cmp_2k_8k.jpg`, 1:1 crops): pano parts as sharp as the fills; the pano/fill boundary
  mostly gone. **Klein places the prompt's nouns in every hole** - a second well at step 1.
- **Fabio flew `chain_cross8k_all_4k.ply`: sharper, but unwalkable - the crossroads pano is
  unusable** (row behind row of houses; fills are single-view sheets, shredded off their camera).

### Open layout: the `ring` pano, 8K (2026-10-07, `ring8k.sh`)

| | cross8k | ring8k |
|---|---|---|
| holes a step, pano only | 12.2-55.1% | 7.2-27.3% |
| depth fit rel err | 2.6-11.9% | 1.2-4.4% |
| fill splats (Klein-invented) | 1,513,676 | 930,693 |
| edge pixels cut, 2K grid | 92,933 | 65,183 |

- Camera clearance 0.30-0.47 on every step. Reuse 18-34% on steps 1-6, 72% on step 7 (looking back).
- `chain_ring8k_all_4k.ply` 9,140,669 splats, 488 MB; lite `_all_2k.ply` 2,962,662, 158 MB.
- By eye (`chain_ring8k_sheet.jpg`): coherent houses, doors, cart, stall and well across steps.
  Weak: step 7 filled the hidden well interior with grass and a fence (prompt nouns), white sky
  patches at step 6.

### One style-free fill prompt across styles (2026-10-07, `prompt_test.sh`, ~17 min GPU)

`chain.py` `GENERIC` (task instruction only: fill the black, continue the surroundings, repair broken
edges, match the image's own style/lighting/detail) + optional `USER_LINE`. Klein 9B inpaint, seed 42.

| run | style | steps | depth fit rel err | by eye |
|---|---|---|---|---|
| `ring8k_gen` | low-poly | 8 | 1.4-3.7% | well interior stone (scene prompt: grass + fence); gaps get walls, not landmarks; blue cloudy sky at 6-7 |
| `ring8k_gen_user` "a dense forest behind the houses" | low-poly | 8 | 1.6-3.5% | forest behind the houses at 4-7; pines lean a little realistic |
| `village_gen` (8K cartoon, `probe` walk) | 2D cartoon | 4 | 1.6-21.5% | outlines + flat palette kept; step 2 (36% holes) meadow + trees, the rock split |
| `real_gen` (new `t2i_fast_real`, 2K) | photoreal | 4 | 2.8-9.2% | hedges, walls, tree, cobbles read as one photo; a pale patch at step 1 |

Camera clearance 0.29-0.45 on every probe step. Village fit error is the known 2D-depth problem, not the prompt.

## Extreme cameras: does Take picture hold? (2026-10-07, `shots.py`, ~14 min GPU)

The product is the STILL from an exactly placed camera (Fabio). ring8k + the `ring8k_gen` walk's 8 fill
layers, rebuilt from the saved Klein outputs (replay = chain.py's holes on all 8 steps, to 0.01%). Rule A =
today (black = no surface or a depth-edge tear). Rule C = A + faces seen from BEHIND (source->screen map
flips) + STRETCH (one source texel > 3 screen px), plus a hand-marked window rect whose back faces are
dropped. Self-check: rule C at the walk's step-0 camera flags 0% back faces. B = whole-frame Klein edit
(wf 4) + Reinhard. Stills in `D:\WORK\Images\Outputs\mpi623_shots\`, sheet `shots_sheet.jpg`.

| camera | holes A / C | back / stretch / bad-fill px (C) | by eye |
|---|---|---|---|
| window: inside the house behind the pano camera, 0.25 behind its window, 24 mm | 0.3 / 84.8% | 78.6 / 1.5 / 2.8% | A = the painted window seen from behind, no view out: FAIL. C + GENERIC + user line "inside a cosy cottage room" = Klein painted the OUTSIDE with a giant second well: FAIL. C + `INTERIOR` instruction (`window_i`, `PROMPT_MODE=interior`) = plaster wall, open casement window, sill, the REAL well and houses outside: passes my eye. Opening is a rect, the outside window is arched |
| treetop: at the left tree's canopy, ~6 m, looking down | 5.9 / 6.5% | 0 / 0.02 / 0.6% | one coherent high shot; B sharpens the magnified near cobbles |
| floor: 3 cm up, 16 mm, looking up | 12.2 / 13.2% | 0 / 0.6 / 0.3% | strong worm's-eye still; hair-thin spikes at sky silhouettes survive inpaint AND polish (they are "known" pixels) |
| behind_well: 0.17 behind the well, looking back | 55.0 / 61.8% | 0 / 0 / 6.9% | the well's back was never seen: Klein invents a stone BASIN, flagstones, a blue cloudy sky. C removes A's torn old-fill strips (jagged basin rim) |

- Polish B: mean change 5.8-9.2/255; sharpens magnified blur, removes specks, does NOT remove the spikes;
  +~35 s a picture (Klein edit returns 1360x768, resized back).
- Behind the left tree is INSIDE the house behind it (A render = smeared trunk, C = 99.98% holes) - dropped.
- Camera placement used `topdown360.py ring8k` + depth probes (`probe_xyz.py`, scratch).
- **Fabio's eye-test on the four C+B stills (window = the INTERIOR run): "1". Clean-up B stays ON for
  every picture (Fabio, 2026-10-07).**

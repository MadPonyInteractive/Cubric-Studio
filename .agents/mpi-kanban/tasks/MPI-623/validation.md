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

## A5 settled: how Take picture dispatches (2026-10-07, code read, no GPU)

Neither of the plan's two routes. The Flow `chain` cannot carry it; the existing direct door can.
- `chain` is two legs, both UNIVERSAL ops: `config.model.id` is `null` and `operation` picks a
  universal graph (`js/services/flowService.js:251-255`); leg 2 never chains again (`:348`). Klein's
  `inpaint` / `kleinEdit` are MODEL ops on `klein-9b` (`models.js:996`, `opInject` `Input_wf_type`
  5 / 4), and Take picture is 3 jobs (inpaint, lift, clean-up). Each leg also lands a card.
- **Route: a scene sequencer calls `enqueueGeneration` once per step with `deferCommit: true`**
  (`generationService.js:1610` withholds every project write; guarded by
  `tests/flow-defer-commit.test.cjs`). Precedent caller: Cutout's Remove Background
  (`MpiStepCutout.js:548-562`, a Promise per job). Steps: `klein-9b` `inpaint` (render + hole mask)
  -> `sceneLift` (new universal op) on the fill -> `klein-9b` `kleinEdit` (clean-up) -> Reinhard +
  depth of field in the app -> upload as a history entry. No copy of the Klein graph, no drift test.
- Same graph branch as the spike: `inpaint` on a frame under `ENGINE_MAX_EDGE` 4096
  (`routes/projects.js:191`) is NOT cut server-side (`commandExecutor.js:250-279` only fits masks over
  the cap), so it reaches the same Klein master graph wf 5 shots.py drove; `opInject` coverage of
  both ops is held by `tests/inject-params-titles.test.cjs:152`. An `inpaint` sends no size and keeps
  the source's (`commandRegistry.js:1759-1762`); `kleinEdit` returns Klein's size (1360x768),
  resized back as shots.py did.
- The proving test moves to Phase 3's Take picture task: the sequencer's own test (configs per
  step, deferCommit on every job, one landing at the end).

## 0d licences and deps (2026-10-07, research sub-agent, key rows spot-checked on disk)

| item | licence | link | verdict |
|---|---|---|---|
| MoGe v1 code | MIT (Microsoft) + Apache-2.0 for the DINOv2-derived parts, one file | `G:\ComfyUi\ComfyUI\custom_nodes\ComfyUI-SplatKit\vendored\LICENSE-MoGe.txt` (Apache at :24) | OK |
| MoGe v1 weights `Ruicheng/moge-vitl` (DINOv2 backbone bundled in `model.pt`) | MIT (HF `license:mit`, empty card, no extra terms) | https://huggingface.co/Ruicheng/moge-vitl | OK, R2 redistribution allowed |
| utils3d (MoGe uses `intrinsics_from_focal_center`, `unproject_cv`, `image_uv`, `image_pixel_center`, `sliding_window_2d`) | MIT; SplatKit's vendored copy has NO licence file - add the notice when we vendor | https://raw.githubusercontent.com/EasternJournalist/utils3d/main/LICENSE | OK + notice |
| three.js | MIT | https://raw.githubusercontent.com/mrdoob/three.js/dev/LICENSE | OK |
| KJNodes `ColorMatch` `reinhard` | offered (`nodes/image_nodes.py:76`) but the node is `DEPRECATED`, KJNodes is GPL-3 and `color-matcher` 0.6.0 is GPL-3 (`METADATA:8`) | `G:\ComfyUi\ComfyUI\custom_nodes\comfyui-kjnodes\LICENSE` | NOT USED: Reinhard runs in the app (A4/A6) |
| MoGe inference imports | torch, numpy (engine), `einops` (`python_deps.in:82`), `cv2` (`:96`), `huggingface_hub` (`:120`), utils3d (vendor) - all covered | `dev_configs/python_deps.in` | OK after the strip below |

- Strip when vendoring (`moge_model.py`): the `hf_hub_download` import (:16) and `from_pretrained`'s HF
  branch (:222-229); `cache_pretrained_backbone` (:237-239) and `load_pretrained_backbone` (:241-244),
  both `torch.hub.load` (training-only). The dinov2 `load_state_dict_from_url` calls are dead after that.
- No non-commercial or territory term anywhere: no STOP.

## A2/A3 data layer (2026-10-07, pulled forward while the GPU was busy)

- `scenePath` on `createImageItem`; `getSceneItem(group)` in `js/utils/assetKinds.js`, read by
  `kindItemOf` (chip + filter), the gallery open intercept, `stackableKind` and the grid's repaint
  key; `scene` in `DERIVATIVE_RE`; add-from-cards copies every `<id>.scene.*` under the new id and
  drops a dead `scenePath`; `/gif/make` refuses a scene item.
- `node --test tests/scene-companion.test.cjs` (4 tests, incl. a scene card whose selected entry is a
  plain picture: still `scene`, never stackable) + splat/asset-kind/filter suites: 42/42. `npm test`:
  2735 pass, 0 fail, 2 skipped. eslint on the 9 touched files: clean.

## Scene workspace shell (2026-10-07, session 29 "3D Scene 19", no GPU)

- `PAGE_SCENE` ('scene') routed at every touch-list site: `router.js`, `navigation.js` (route,
  lazy import, breadcrumb/accent/ENTRIES stats shared with History, up-arrow -> gallery),
  `focusModeService` (`page-scene`), `MpiFlowLibrary._inProject`, `agentService` (the agent sees
  the card). `agentDispatch` left alone: nothing dispatches from Scene yet.
- `MpiSceneCanvas` (Primitive): three ^0.186.1 `WebGLRenderer` on a transparent canvas, empty
  `Scene` + `PerspectiveCamera`, render ON DEMAND (`requestRender`), ResizeObserver bails on 0x0.
  Teardown: cancel RAF, disconnect, `dispose()`, `forceContextLoss()`, zero canvas, null refs.
  No WebGL2 -> `--unsupported` note. `MpiSceneBlock` mounts it. Both registered (preload, types).
- Intercept: `dev_mode && !stack && getSceneItem(group)` -> `navigate(PAGE_SCENE)`; dev_mode off
  -> Group History (the old "not built yet" toast is gone). Gallery right-click **Convert to 360
  pano** via `canConvertToPano(group)` (assetKinds.js: image card, no scene, selected entry a plain
  still at exactly 2:1), dev_mode only, single card, DISABLED until Phase 2 wires `sceneConvert`.
- **WebGL2 EXISTS under `CUBRIC_E2E`** (GPU off, software GL): the spec's 10 contexts were real.
- `tests/desktop/scene-workspace.spec.js`: 10 real left-click round trips -> 10 webgl2 contexts
  made, 0 live after, 0 canvases sized, no Scene canvas left; a scene card whose selected entry is
  a plain picture opens Scene and wears `data-kind="scene"`; Convert offered (disabled) on a 2:1
  still, absent on 16:9 and on the scene card. **Failing direction proven:** with
  `forceContextLoss()` commented out the spec fails `every context lost on leave: received 10`.
- `tests/scene-workspace.test.cjs` (4 tests, the Convert gate). `npm test` 2739 pass, 0 fail;
  `npm run lint` clean; desktop scene + workspace-sweep + focus-mode + gallery-filter-panel: 9/9.
- Not run: an `app:isolated` look on the real GPU (nothing to see yet but an empty canvas);
  Convert on a 2K pano (Phase 2).

## Phase 2 MpiNodes: code + CPU checks (2026-10-07, session 30 "3D Scene 20", no GPU)

MpiNodes `3e8d7d2` (main, pushed, not pinned): `scene.py` (6 nodes, category
`MpiNodes/Scene`), `scene3d/` (pure maths, no ComfyUI import), `tests/test_scene3d.py`, registration
in `__init__.py`, README § 3D Scene, two changelog lines under V1.2.17, `/tests/` in `.comfyignore`.

- **Vendored MoGe v1** in `scene3d/moge/`: `model.py` (0d strip list applied: no HF download, no
  hub loaders, no `importlib`, `from_state_dict` only), `geometry.py`, `panorama.py` (MoGe's
  `infer_panorama.py` as Matrix-3D changed it + SplatKit's in-process wrapper), `utils3d.py` (the 12
  functions used), `dinov2/` (xFormers, env reads, logging, download and DINOHead removed; Apache
  change notices in each edited file). `LICENSE` carries MoGe MIT + Apache-2.0, Matrix-3D MIT,
  utils3d MIT (`Copyright (c) 2022 EasternJournalist`, fetched from its repo).
- **Weights format: `.safetensors` in `models/moge/`** (no pickle in the pack; the config of the one
  shipped checkpoint is `MOGE_VITL_CONFIG` in `scene.py`, asserted equal to `model.pt`'s own).
  Recipe for the Ship step: `safetensors.torch.save_file({k: v.contiguous() for k, v in
  ck["model"].items()}, ...)` from `torch.load(model.pt, weights_only=True)`.
- **Contract with the app** (Phase 2's ops build on it): depth is a raw `<f4` file, no header,
  under `output/scenes/`, path returned as STRING (the `Output_Splat` pattern).
  `MpiPanoDepth` -> `depth_width/2 x depth_width` (default 1024 x 2048), sky = 2x the farthest
  valid depth (export_records.py's rule). `MpiLiftDepth(image, known_depth, fov_x)`:
  `known_depth` = a `<f4` file in `input/` the size of the fill, camera z, 0 = unknown -> depth file
  with 0 = not kept + `fit_error` (median rel). `IS_CHANGED` hashes the file. Wrap Crop / Cut Merge
  take the PRE-pad image as `reference` so the pad scales with any upscale.
- `tests/test_scene3d.py` (engine python, CPU): **9 passed** - pad/crop round trip incl. a 4x
  upscale, soften leaves columns past `radius` untouched and keeps a hard edge at threshold 6,
  cut merge = identity on two equal renders and meets each side's tone, depth edges, lift recovers
  a=2.5 b=0.3 exactly and keeps the holes grown 2 px, empty known map raises, pano direction round
  trip, 12 orthonormal cameras, a constant room merges flat.
- **Vendoring parity, CPU, real weights** (scratchpad `parity_moge.py`): vendored `MoGeModel.infer`
  vs SplatKit's copy on one 512x384 view: points / depth / intrinsics max abs diff **0.0**, masks
  equal (6.7 s for both).
- **Pano depth vs the spike, CPU** (plan verify, GPU half replaced by CPU): `panorama_depth` on the
  ring 8K pano at 2048x1024, level 9, vs `pano_depth_ring8k.npz`: rel err **median 0.46%, mean
  0.77%** (< 1%), p99 4.2%, valid mask agrees 99.97%, scale ratio 0.99987; 104 s on CPU.
- **Whole-pack smoke** (scratchpad `node_smoke.py`: the pack imported as ComfyUI does, `--cpu`, scratch
  input/output/models dirs): all 6 nodes registered with display names; wrap nodes run; `MpiLiftDepth`
  on a real picture with known z = 2.5 x MoGe + 0.3 on the left 60%: fit_error 5.5e-6, keeps 100%
  of the right side and 0% left of the 2 px growth, max rel err on kept 5.4e-5; `../outside.f32`
  refused; `MpiPanoDepth` node vs a direct `panorama_depth` call: median rel 3e-5, 4 of 2M pixels
  flipped valid (CPU run-to-run noise at MoGe's 0.8 mask threshold).
- Registry self-check grep (`publishing.md` + `os.environ|subprocess|torch.load|PromptServer`) over
  `scene.py`, `scene3d/`, `tests/`: clean. No route, no download, the only path widget goes through
  `resolve_input_file`.
- **Found:** the sky rule "2x the farthest valid depth" is outlier-led: the CPU run's valid max is
  18.9 vs the spike's 15.7, so the sky dome lands at 37.8 vs 31.5 for the same pano. Known pixels
  are unaffected; noted for Phase 3's viewer (a percentile would be steadier).
- **Not run (GPU, bench, needs the lease):** the pano on the GPU, and the lift fit error per step
  vs `chain_ring8k_gen.log` (needs the spike's known-z renders, which only its GPU raster makes).

## Ship, GPU-free half: MoGe weights + dep entry (2026-10-07, session 31 "3D Scene 21", no GPU)

The GPU lease was session 28's (spike 0a), so this ran instead of the bench.

- **Conversion** (scratchpad `convert_moge.py`, engine python, CPU): `G:\ComfyUi\ComfyUI\models\MoGe\model.pt`
  -> `G:\CubricModels\moge\moge_vitl.safetensors` (the local master copy `computeDepHashes.py` reads).
  The checkpoint's own `model_config` == `MOGE_VITL_CONFIG`, no extra keys; 421 tensors, all fp32,
  every tensor `torch.equal` after the round trip. **1,256,740,032 bytes, sha256
  `dbdf89d1f7651b9213a507923b4f100fed87489bb7425fda7f7d430bcb31d8a9`.** The vendored
  `MoGeModel.from_state_dict` (strict) loads it and infers on a 384x256 image.
- **Dep `moge-vitl`** in `js/data/modelConstants/assetDeps.js`: `filename: 'moge/moge_vitl.safetensors'`,
  R2 url, `size: '1.17GB'` (the script's own `format_size`), `noMirror: true` (our bytes, no upstream
  twin; drop it after an HF re-host), MIT `credit`. **NOT `engineAsset`**: that lands 1.17 GB on every
  engine install while the feature is dev_mode-only - the `sceneConvert` step decides how it installs.
  Nothing references it yet, so nothing downloads it.
- **Pod folder map:** `moge: mpi_models/moge/` added to `c:\AI\Mpi\mpi-ci\cubric-vision-pod\start.sh`
  (release:check's MPI-143 guard fails without it). The wrapper needs nothing (`MODEL_SUBDIRS.get(s, s)`).
  Not live on any Pod until `publish-runtime.sh dev`.
- Checks: `npm run release:check` passed; the guard regex sees `moge`, the local yaml builder emits
  `moge:`, `DEPS['moge-vitl']` resolves; `npm test` 2739 pass / 0 fail; eslint clean on assetDeps.js.
- **Not done (Fabio's call):** the R2 upload (~7 min at the 3 MB/s cap), the HF re-host, and
  `publish-runtime.sh dev`. Until the upload, `npm run release:deps` reports the url as a 404.

## Phase 2 bench, GPU half (2026-10-07, session 31, RTX 4060 Ti, under the lease, ~6 min)

Scratchpad `bench_gpu.py` (results `bench_gpu.json`), run with the bench's python; read the spike dir
only. MoGe loaded from the SHIPPED `moge_vitl.safetensors`.

- **Pano depth on cuda** (ring 8K pano at 2048x1024, level 9) vs `pano_depth_ring8k.npz`: rel err
  **median 0.46%, mean 0.77%** (< 1%, PASS), p99 4.2%, valid mask agrees 99.97%, scale ratio 0.9999;
  **46 s**, peak torch VRAM **2.8 GB**. Same numbers as the CPU run, so the GPU adds nothing.
- **Lift per step:** chain.py's `ring8k_gen` walk replayed on the spike's GPU raster with the SAVED Klein
  fills (`D:\WORK\Images\Outputs\mpi623_chain_ring8k_gen\fill_step*.png`, no Klein call); each step runs
  the spike's own fit (it also builds the layers, so the walk stays the logged one) and the node's
  (vendored MoGe + `scene3d.lift_depth` on known z = render z where known, 0 elsewhere). **All 8 steps
  PASS, exactly:** fit `a, b` identical to the log's to 4 decimals, fit error identical (3.09 / 2.15 /
  3.70 / 3.06 / 2.15 / 2.91 / 2.39 / 1.42 % vs the log's rounded 3.1 / 2.2 / 3.7 / 3.1 / 2.2 / 2.9 /
  2.4 / 1.4), kept pixels == the log's `layer_splats` on every step, keep IoU 1.0, kept depth median
  rel diff <= 3e-7.
- The SplatKit shim printed `triton raster backend unavailable` (tcc cannot find `Python.h`) and fell
  back to its torch raster - the spike's own path, so no effect on the comparison.

## Ship: R2 upload + pin (2026-10-07, session 31, Fabio's yes for the upload)

- **R2:** `moge/moge_vitl.safetensors` uploaded (`--bwlimit 3M`, ~7 min, one run, no restart so no
  orphaned multipart). `rclone lsl` = **1,256,740,032** bytes, byte-exact. Public HEAD with a browser
  User-Agent: 200, same Content-Length. **A Python-default-UA HEAD gets 403 from Cloudflare on EVERY
  object** (birefnet too) - not an upload fault. Still `noMirror: true`: the HF re-host was not asked for.
- **Pin:** `dev_configs/node_lock.json` MpiNodes `bc92a1b` -> **`3e8d7d2995357bb67323fce91c5d31cf9aa6b821`**
  (pushed; archive URL HEAD 200; MpiNodes tree clean, HEAD == origin/main). Adds 6 classes, removes none
  (`__init__.py` diff). The `from .scene import` is unguarded, so a failed import would take every
  MpiNodes node down: the scene modules import cleanly in the APP engine's python (cv2 5.0, scipy 1.18,
  both pinned in `python_deps.txt`, which the Pod installs too). Volume node: no image rebuild.

## Phase 2 ops: sceneConvert + sceneLift (2026-10-07, session 31)

- **Graphs** (`comfy_workflows/raw/scene_*.json` LiteGraph, generated from the bench's `/object_info` by
  scratchpad `make_scene_raw.py`, synced by `sync-raw-workflows.mjs`; injection validator clean):
  `scene_convert` = `Input_Image` -> width < 4096 ? (Wrap Pad 32 -> AnimeSharp 4x -> Wrap Crop) : as is
  (`MpiCompare` + lazy `MpiIfElse`) -> scale 8192x4096 -> `Output_Image` + `MpiPanoDepth` (2048) ->
  `Output_Depth`. `scene_lift` = `Input_Image` + `Input_Known_Depth` (**`MpiString`**: a
  PATH_MEDIA_CLASSES node, so the engine stages the f32 into input/ or uploads it to a Pod) +
  `Input_Fov_X` (`MpiFloat`) -> `MpiLiftDepth` -> `Output_Depth`.
- **Bench live run** (scratchpad `run_scene_graphs.py`, title injection like the app, under the lease):
  `sceneConvert` on `mpi623_ring_2k.png`: **92 s**, 8K texture **pixel-identical** to the spike's
  `ring_8k_00001_.png` (mean abs diff 0.0), depth vs `pano_depth_ring8k.npz` median 0.46% / mean 0.77%,
  sky share 22.64% vs 22.64%. `sceneLift` on walk steps 0 and 4 (known z dumped from the replay,
  uploaded through `/upload/image` - byte-identical round trip): kept **65,945 / 178,302** px vs the
  log's 65,945 / 178,303, keep IoU 0.99994 / 0.99997, depth rel diff 7e-6; 4 s / 2 s.
- **App side:** `runSceneOp` (commandExecutor.js, beside `runGifCutoutTrack`): direct dispatch, captures
  `Output_Image` + `Output_Depth` -> `onResult({ imageUrl, depthUrl })`. Not `runCommand`: a depth-only run
  reads as a CANCEL in generationService (`!urls.length` -> `onCancel`), and Convert must not make a card.
  `splatViewFileInfo(path, dir)` gained `dir` ('scenes'). Registered in the 4 files (`appVersionIntroduced`
  2.0.1); `flow-output-filename.test.cjs` lists both as save-nothing ops like `gifCutout*`.
- Checks: `tests/scene-ops.test.cjs` 6/6 (fails if `Input_Known_Depth` leaves PATH_MEDIA_CLASSES);
  `npm test` 2745 pass / 0 fail; eslint clean; `release:check` passed.

## Convert to 360 pano wired (2026-10-07, session 31, dev_mode only)

- Gallery row enabled (`MpiGalleryGrid` emits `convert-pano`); `MpiGalleryBlock` runs
  `convertToPano` (`js/services/scene/sceneConvert.js`): `runSceneOp('sceneConvert')` on the selected
  still -> `POST /project-media/:id/scene` -> mirror `scenePath` on the live item + `gallery:item-updated`
  (the card-notes pattern) so the card repaints with its 3D badge and opens in Scene. Info toast at the
  start, success / error toast at the end; a module-scoped set stops a second click starting a second
  8K job while one runs.
- **Route** (`routes/projects.js`): downloads the 8K + depth over /view into `<id>.scene.pano.png` +
  `<id>.scene.pano_depth.f32`, writes `<id>.scene.json` = the spike's records shape
  `{version 1, pano {image, depth, w, h, sky}, layers []}` with siblings named by SUFFIX, `scenePath`
  last. Grid size from the byte count (2:1 float32), sky = the max. Unknown / unsafe item id -> 404
  (`updateItemMeta` would mint a sidecar); any failure removes every `<id>.scene.*` it wrote.
- Checks: `tests/scene-convert.test.cjs` 3/3 (fake /view engine: manifest, siblings, sidecar,
  DERIVATIVE_RE owns every file; failure cleanup; bad ids); `tests/desktop/scene-workspace.spec.js`
  green with the row now ENABLED; `npm test` 2748 pass / 0 fail; eslint clean.
- **Not run:** a real Convert in the app - same blocker as the ops (engine restart on the new pin).

## Live Convert in Fabio's app (2026-10-08, session 32 "3D Scene 22")

Closes the Phase 2 ops verify AND the Convert verify.
- Boot 08:13 UTC: `node drift: ComfyUI-MpiNodes installed=bc92a1b pinned=3e8d7d2` -> pre-wiped,
  downloaded the `3e8d7d2` archive, marker stamped; `.mpi_node_commit` reads `3e8d7d2995...`.
- Fabio dropped `mpi623_ring_2k.png` (sha256 `dd1cd54d...`, == the bench input) into a fresh project
  (`MPI-623 Convert test`) and right-clicked **Convert to 360 pano** (log `select convert-pano`
  08:23:06); engine `Prompt executed in 71.47 seconds`.
- On disk: `<id>.scene.json` = `{version 1, pano {image "pano.png", depth "pano_depth.f32", w 2048,
  h 1024, sky 37.91}, layers []}`; `<id>.scene.pano.png` **8192x4096** RGB; `<id>.scene.pano_depth.f32`
  8,388,608 B = **2048x1024** float32, all finite, max == the manifest's sky; the item sidecar
  carries `scenePath`. Still ONE card with ONE history entry: Convert made no card.
- Depth vs the spike's `pano_depth_ring8k.npz` (non-sky pixels, 1.62M): rel err **mean 0.80%**, p99
  4.3% - the bench's 0.77% within GPU noise.
- The card repainted with the cube badge; a left-click opened the Scene page (breadcrumb
  `MPI-623 Convert test / imported_001`, empty canvas - Phase 3 draws into it).

## Fabio's four Phase 2 calls, settled (2026-10-08, session 32)

- **yaml gap BUILT.** Checked first: the yaml was written only by `engine.js` install (and only
  when absent), `/comfy/set-path` and `/comfy/extra-folders`; boot only read it. New
  `syncExtraModelPathsYaml` (`routes/shared.js`) rewrites it when it differs from what the builder
  derives; `/comfy/start` calls it before spawn (a failed rewrite logs and boots on the old file).
  `tests/extra-model-folders.test.cjs`: a yaml missing `moge:` is restored byte-for-byte, a second
  call is a no-op (5/5). Fabio's hand-patched yaml == the builder's output, so his next boot
  leaves it alone.
- **moge-vitl -> the `scene-convert` plugin** ("3D Scene", `devOnly`, `PLUGINS` filtered like
  `MODELS`). Checked first: no plugin owned it, so nothing protected it from GC. The gallery
  handler warns "3D Scene is not installed. Add it from the Model Library (Plugins)." before the
  info toast. `tests/scene-convert.test.cjs` 4/4: the plugin owns `moge-vitl`, an unrelated
  uninstall keeps it, the plugin's own uninstall can reclaim it. AnimeSharp needs no edge (engineAsset).
- **HF re-host:** weights stay on R2; the HF mirror is a Phase 4 dev_mode gate.
- **`publish-runtime.sh dev` DONE.** Before: mpi-ci clean + == origin/main, dev manifest == stable
  (no peer bytes on dev). After: dev `start_sha256` `e3712063...` == mpi-ci HEAD's `start.sh`,
  served file maps `moge: mpi_models/moge/`; wrapper 0.2.45 and stable untouched.
- `npm test` 2750 pass / 0 fail; eslint clean on every touched file.

## Spike 0a GPU half: renderer parity PASS (2026-10-08, session 33, RTX 4060 Ti, under the lease, 472 s)

Full record: [research/spike-0a.md](research/spike-0a.md). Rule C vs `shots.py` at the four extreme
cameras: IoU 0.9995-0.9998 (gate >= 0.98), mean colour diff 0.065-0.129/255 (gate <= 2/255).
1080p with all 8 layers and rule C: 1.92-2.30 ms/frame = 435-521 fps (gate >= 60). Page VRAM ~650
MiB (1522 open / 871 closed), leaving ~14.6 GB on this card against Klein's ~14.5 GB need: tight,
so the viewer drops its render targets during Take picture. Self-check 0.00%. Found and fixed in the
page: three 0.170's reverse-depth clear bug (every render empty); 0.186 fixes it but renames the
option `reversedDepthBuffer`, which the port must use. Floor-still spikes: band 3 turns 1835 known
silhouette px into holes (none the other way); the by-eye check on a FILLED still moves to Take
picture. Run: `gpu_lease.py run -- python -u D:/WORK/MPI-623-spike/single_shot/serve.py`, then
`window.scene.parityAll()` / `bench()` / `selfCheck()` on `http://127.0.0.1:8623/`.

## Phase 3 GPU-free: History to gallery stack + Wan bake stub (2026-10-08, session 33 "3D Scene 23", no GPU)

The GPU was held by the MPI-1036 peer (`mask_bench.py` under the lease) for this part.

- **History to gallery stack.** `MpiHistoryList`'s Add to gallery is no longer single-only: it
  emits `{ indices }` and reads "Add to gallery as a stack" when several are selected.
  `MpiGroupHistoryBlock` makes one plain card per entry (`_addItemToGallery` now returns the group,
  re-upload as before, so no scene field travels) and then `stackGroups`, named after the card.
  One entry is unchanged. `tests/desktop/history-add-stack.spec.js`: three entries (the first
  carrying a `scenePath`) -> one image stack of three one-entry image cards, none a scene, source
  card keeps 3 entries, the stack persists in `project.json`. Mutants killed via
  `scripts/mutate-check.mjs`: never stacking (`added.length < 99`), and copying the entry
  (`createImageItem({ ...item,`; `stackGroups` then refuses the scene card, no stack forms).
  Run: `npx playwright test --config=playwright.desktop.config.js tests/desktop/history-add-stack.spec.js`.
  Same pass green: gallery-stack, history-list-thumbs, history-modes, history-prompt-model,
  stack-history, video-history-strip, workspace-sweep (15/15); `tests/mask-tool-registry.test.cjs` 44/44.
  Not dev-gated: A8 hides the Scene workspace, Convert and the Pano tile only, and this is a
  plain History improvement. The Scene workspace's own history list (Phase 3 picture panel)
  reuses the Compound event.
- **Wan bake stub.** `MpiSceneBlock` tools strip: one ghost `MpiButton` "Bake 3D" (icon `cube`),
  `disabled`, `info` "Coming soon: bake the whole scene into full 3D" (the status bar hint; a
  disabled `.mpi-btn` keeps hover, as the gallery selection bar relies on). Destroyed with the
  Block. `tests/desktop/scene-workspace.spec.js` § 4: shown, disabled, says why, a click leaves the
  page on Scene; mutant (drop `disabled: true`) killed.

## Phase 3 viewer scaffold + the hotkey gate fix (2026-10-08, session 33, no GPU)

- **Viewer scaffold** (`js/services/scene/sceneViewer.js`, `MpiSceneBlock`): `loadScene` reads the
  manifest and its siblings by suffix (`sceneFileUrl`), `createPanoMesh` = the spike's grid
  (`panoGrid`, seam column doubled) + per-fragment equirect lookup in a raw shader (no colour
  management), `applyPose` = the spike's `setCamera` (lens across the frame WIDTH, re-applied on
  MpiSceneCanvas's new `resize` event), `flyStep` / `flyLook` = the spike's fly. Block: WASD/QE held
  keys (`scene.fly.*`, DOWN + UP entries gated to the Scene page), drag look via `on()`, a rAF loop
  only while a key is held, `getPose` / `setPose`, teardown aborts the load and disposes geometry,
  material, texture and bitmap. `tests/scene-viewer.test.cjs` 5/5 (sibling URL, grid shape + seam,
  fly axes, look clamp, camera position in the y-down world + fov 45.7473 deg at 24 mm 16:9).
  `tests/desktop/scene-viewer.spec.js`: a fixture scene written as Convert writes one (64x32 pano
  of four colour bands at depth 5); centre pixel at yaw 0 / +90 / -90 / 180 is blue / red / yellow
  / green within 2/255 (green across the seam); W moves +Z, A moves -X, A leaves `state.agentMode`
  alone, the camera stops on release. Mutants killed: mirrored lookup (`fract(mod(...` -> "right is
  red, got 230,210,30"), and `agentMode.toggle` un-gated -> "A did not toggle Agent mode".
  NOT yet: rule C, fill layers, frame guides, lens UI, the golden-PNG verify.
- **hotkeyManager per-entry gate.** Handlers are stored per registry id in bind order; a key fires
  the handlers whose OWN entry passes typing + `when`, one call per function. Measured first
  (`scratchpad/keys.mjs` over the registry): only Escape (`promptBox.blur`) and Space-up
  (`dictation.release.space`) had entries with different gates, and both handlers no-op outside
  their gate, so nothing that worked changes. `tests/hotkey-gating.test.cjs` 4/4; mutant (shared
  verdict back) kills 2. `flow-close-destroys-instance.spec.js` read `_handlers...size`, now
  `.length`. Desktop specs that press keys: 71/71 (agent-chat, cancelled-mascot,
  context-menu-owns-right-click, cue-send-countdown, delete-offers-archive,
  flow-close-destroys-instance, flow-queue-hotkey, focus-mode incl. "A opens and closes the agent
  panel", fullscreen-titlebar, notes-enter-newline, radial-menu, gallery-filter-panel, mask-colour,
  colour-pick-eyedropper, canvas-pan-no-repaint, gif-workspace). Hotkeys page: a "3D Scene" group
  only under `dev_mode`. `docs/shell.md` § Gating model says per entry.
- `npm test` 2759 pass / 0 fail; eslint clean on every touched file; scene-workspace spec green.

## Phase 3 viewer: rule C + fill layers in the app (2026-10-08, session 34 "3D Scene 24")

- **Ported** from spike 0a into `js/services/scene/sceneViewer.js`: `depthEdges` (3x3 spread > 5%),
  `panoGrid` + `src` (texel in the TEXTURE) + `edge` + `SKY_BAND` 3 + `pano.windows` faces last,
  `layerGrid` (kept pixels back-projected through the OpenCV w2c), `createSceneView` (pano and layer
  MRT passes into float targets with float depth, composite, `view` 1 magenta / 2 self-check,
  `draw({ out })`, `dropTargets`), `RENDERER_OPTIONS` with **`reversedDepthBuffer`** (the 0.186 name).
  `MpiSceneCanvas` now takes a draw callback (`setDraw`, `renderNow`; no `getScene`) and logs a
  warning when `capabilities.reversedDepthBuffer` is false; `MpiSceneBlock` loads layers too.
- **three ^0.186 trap found:** under reverse depth `WebGLRenderer` calls `camera.updateProjectionMatrix()`
  on every camera it renders with; the composite's bare `Camera` has none (`TypeError` on the first
  frame, caught by the desktop spec's page-error check). Fixed with an `OrthographicCamera`.
- **GPU parity, the APP's module in Electron 41 (the app's Chromium), RTX 4060 Ti, ANGLE D3D11,
  reverse depth ON, under the lease:** scratch harness `scratchpad/parity/` (main.js serves the repo +
  the spike records, `parity.js` = `loadScene` -> `createSceneView` -> `applyPose` -> `draw({ out })`,
  scored exactly as the spike's `parity()` against `ref/<cam>_C_render.png`). Rule C, sky band 0:

  | cam | IoU | mad /255 | holes % (ref) | mine-only / ref-only px |
  |---|---|---|---|---|
  | window | 0.9999 | 0.125 | 84.78 (84.78) | 3 / 9 |
  | treetop | 0.9999 | 0.125 | 6.48 (6.48) | 38 / 24 |
  | floor | 0.9995 | 0.101 | 13.19 (13.16) | 89 / 310 |
  | behind_well | 0.9997 | 0.064 | 61.82 (61.82) | 81 / 35 |

  Gates (IoU >= 0.98, mad <= 2/255) pass on all four. Self-check at walk0: 0.00% pano back|stretch.
  1080p, all 8 layers: 4.14 ms (242 fps) over 120 and 240 frames, vs the spike page's 2.30 ms; the
  peer's engine held ~12.6 GB and had just run (not chased: 4x over the 60 fps gate). Sky band 3 (the
  viewer default): floor ref-only 310 -> 2145 px, i.e. +1835 known px become holes, the spike's exact
  number; the other three cameras move by <= 22 px. The same harness on WARP (CPU D3D11, the dry run):
  IoU 0.9995-0.9999, mad 0.061-0.122.
- **Specs:** `tests/scene-viewer.test.cjs` 9/9 (+4: depth edges, sky band wraps the seam, window faces
  last and reordered only, layer back-projection + kept-corner faces). `tests/desktop/scene-viewer.spec.js`:
  the fixture grew to a 4096x2048 texture (rule C calls a 64 px pano a stretch everywhere) with the behind
  band at depth 2.5 and one 64 px fill layer at yaw 45 deg; asserts reverse depth TRUE (Electron's
  SwiftShader has `EXT_clip_control`), the four band colours, the red/green step is a hole (alpha 0), the
  layer's colour wins over the pano, plus the fly keys. Green with `scene-workspace.spec.js` (10 visits
  free their GL context). `npm test` 2763 pass / 0 fail; eslint clean on every touched file.

## Phase 3 picture panel + Take picture, GPU-free half (2026-10-08, session 34)

- **Built:** `sceneViewer.js` roll (`pose.roll`, Z/C `scene.fly.rollLeft|rollRight`, roll > 0 tilts
  right), `pictureSize` (16:9 1360x768, 9:16 768x1360, 1:1 1024x1024), `renderPicture` (frame + white-
  hole mask + known camera z + back-face share + `layerCamera` record; rule C's bad now encodes 2 =
  back face, 1 = stretch, and the composite's `view` 3 reads z and back faces), `loadLayer`,
  `view.addLayer`, `groundBelow` + `EYE_HEIGHT_M`. `POST /project-media/:id/scene-layer` (copy the
  fill, download the lifted depth, append the record, manifest last, clean up on failure).
  `scenePicture.js`: `takePicture` over injectable doors (`appIo()`), `fillPrompt` (GENERIC /
  INTERIOR at > 50% back faces + the fill line), `colorLock` (Reinhard in CIELAB), prompts from the
  spike (INTERIOR with its cottage nouns removed). `MpiSceneBlock`: letterboxed frame, picture panel
  (aspect radio, lens dropdown, height/mm/roll readout, presets + fill line, Take picture, status),
  the card's `MpiHistoryList` (an entry's `scenePose` flies camera + frame + lens; selecting persists
  `selectedIndex`); float targets dropped once the render is read.
- **Checks:** `tests/scene-viewer.test.cjs` 13/13 (+ ground estimate, picture sizes, roll + the
  layer record back-projecting a rolled, turned picture onto its own rays). `tests/scene-picture.test.cjs`
  6/6: step order render -> inpaint -> sceneLift -> kleinEdit -> save; every Klein job
  `{ deferCommit: true }` with one media item; inpaint gets `maskDataUrl` + GENERIC + the fill line,
  clean-up gets POLISH on the FILLED frame; lift gets the fill, the `.f32` asset's `absPath`, fovX
  73.7398 at 24 mm; the layer POST carries the render's own camera and the view meshes it; one
  `savePicture` with `scenePose` incl. aspect + fill line; INTERIOR at backFrac 0.6; no holes = no
  fill/lift/layer but clean-up still runs; a failed inpaint saves nothing. Colour lock: identity
  within 1/255, a drifted edit's channel means return to the frame's within 2. `tests/scene-layer.test.cjs`
  3/3 (two layers numbered, pano untouched, siblings ride `DERIVATIVE_RE`; wrong-size depth leaves
  manifest + folder as they were; no scene / unsafe id / fill outside the project / bad camera
  refused). `tests/desktop/scene-viewer.spec.js` + the panel: readout `Height 1.60 m · 24 mm · roll 0°`,
  Take picture enabled once loaded, frame 1.78 -> 1:1 = 1.00, C rolls right and the readout follows,
  the picture entry restores `{ pos, yaw, pitch, roll, mm }` exactly, the 9:16 frame (0.56) and
  `35 mm`. Mutant (entry click no longer calls `setPose`) killed. Both scene desktop specs green;
  `npm test` 2775 pass / 0 fail; eslint clean on every touched file.
- **NOT yet run: Take picture end to end on an engine** (Klein 9B needs ~14.5 GB free; the peer's
  sweeps held the lease and 12-14.5 GB all afternoon). That run closes the panel's verify: an
  isolated app on a converted scene, a picture from each of the four spike cameras by eye, the layer
  in the manifest, one entry per press, no stray cards; it is also `sceneLift`'s first app dispatch.

## Take picture end to end on the engine (2026-10-08, session 35 "3D Scene 25", 4060 Ti, under the lease)

Rig: a Playwright `_electron.launch` of the real app (own profile `cubric-agent-profile`, own port,
`APP_DOCUMENTS` scratch, `CUBRIC_BACKGROUND`), attached to Fabio's engine on 48188 (queue empty, his
heads-up given), on a scratch copy of his converted `MPI-623 Convert test` card (ring 2K, 8K pano)
plus the spike's window rect; the real **Take picture** button clicked at the four spike cameras
(`viewer/records/scene.json` poses, roll 0). Scripts: session scratchpad `take.cjs`, `dbg/`.
- **Run 1 found two breakers, both fixed at the root:**
  1. `sceneLift` failed "fewer than 2 known pixels": the known-depth `.f32` was ALL zeros (its sha
     == the zero buffer's). `COMP_FRAG`'s self-check branch `uView > 1.5` also caught view 3, so
     `renderPicture` read rule-C flags as z. Now `uView > 1.5 && uView < 2.5`. INTERIOR had been
     picked by accident (g = "real surface", not "back face").
  2. The scene MANIFEST vanished mid-run: save-generation's sidecar GC read `<id>.scene.json` as a
     sidecar (no `filePath` -> `Media/<id>.scene` "gone") and deleted it. Every generation saved in a
     project wiped every scene in it. `isSidecarFile` (`routes/projects.js`) = `.json` minus
     `DERIVATIVE_RE`, used by all seven `.meta` sidecar scans in that file (the GC was the only one
     that deleted; the rest read it harmlessly). `agentCards.mjs`, `gifFrames.js`,
     `projectMigrations.js` also list `.meta/*.json` and only READ fields a manifest never has.
- **Runs 2-3, all four PASS on bookkeeping:**

  | camera | s (fill / lift / clean) | holes at render | entry | layers | cards |
  |---|---|---|---|---|---|
  | window | 68.3 (39.5 / 2.5 / 25.8) | 85.1% | +1, `scenePose` all 7 keys | 0 -> 1 | 1 |
  | treetop | 59.5 (33.0 / 2.0 / 23.9) | 12.5% | +1 | 1 -> 2 | 1 |
  | floor | 76.6 (50.5 / 2.0 / 23.5) | 14.6% | +1 | 2 -> 3 | 1 |
  | behind_well | 65.1 (38.4 / 2.5 / 23.6) | 75.8% | +1 | 3 -> 4 | 1 |

  One history entry per press, selected, sidecar carries `scenePose` (`pos yaw pitch roll mm aspect
  fillLine`) and 1360x768; the manifest grew `layer<n>.png` + `_depth.f32` each press and survived
  eight generation saves; no gallery card was added. Each press leaves its deferred `inpaint_NNN` +
  `edit_NNN` PNGs (+ sidecars) in `Media/` for Cleanup, the deferCommit contract. Fixed on the way:
  the picture's name was only in memory (sidecar said `scene_001`); `update-meta` now carries
  `displayName`.
- **By eye** (sheet `take_picture_vs_spike.jpg`, scratchpad): treetop ~= the spike's; floor has NO
  sky-silhouette spikes (the spike's still has them: sky band 3 holds); behind_well a coherent back
  courtyard, no invented basin; window = an interior looking out through an opening at the well,
  read as a doorway with stone blocks along its sill (this scene has no walk layers, and INTERIOR
  has no window nouns). **Fabio's eye on the four stills: "1" (2026-10-08).**
- **Breaker 3, the fill did not sit in the viewer:** at behind_well's OWN camera 44% stayed holes
  with all four layers loaded, 9.5% with only its own. Debug rig (patched composite dumping per-pixel
  flags): 372k px had a NEARER layer fragment that rule C rejects - treetop's and floor's ground
  fills, seen stretched from 0.6 m and > 3% in front of behind_well's own ground (two fits of one
  ground disagree by ~1 cm, which at a grazing angle is far more than any z tolerance; a 3% depth
  bias was tried and moved 44.0 -> 43.6%). Fix: `LAYER_FRAG` DISCARDS a rule-C-bad fragment, so a
  rejected fill never occludes; the pano keeps its bad faces. Holes left at each own camera, all
  layers: treetop 0.4%, floor 6.5%, behind_well 8.4% (sky and depth edges the lift does not keep).
- **Window (open, needs a lift contract change):** 64% still holes at its own camera: 426k px where
  the room fill lies BEHIND the house walls' back faces (layer/pano z p50 1.077, p95 1.185). The lift
  fitted the room's depth only on the far view through the opening, so the room is pushed out past
  the walls. Root fix is in `MpiLiftDepth`: fit against the back-faced walls' z too while still
  keeping those pixels (e.g. negative z = known for the fit, kept). Build here (0b) needs the same.
- **Parity vs the spike moved by design:** the same harness as session 34 (copied), band 0: IoU
  window 0.9971, treetop 0.9978, floor 0.9974, behind_well **0.9198** (30,625 px the spike calls holes
  now show a walk fill that a stretched sheet used to hide - a ground patch, checked by eye); colour
  mad unchanged (0.06-0.13); 1.71 ms / 586 fps at 1080p. The 0a gate measured the PORT; this is a
  deliberate rule change for fill layers.
- **Checks:** `tests/save-generation-gc.test.cjs` +1 (a scene card's manifest + companions survive
  another item's save; mutant = the old `.json` filter, killed). `tests/desktop/scene-viewer.spec.js`
  +2: `renderPicture`'s z ahead 4.5-5.1 and 1 +- 0.1 on the layer, `backFrac` 0 (mutant = the old
  branch: "got 0", the live failure); a back-facing fill at 0.5 in front of the layer does not hide it
  (mutant = no discard: "got 255,255,255,255"). Scene unit tests 43/43, both scene desktop specs
  green, eslint clean on every touched file.

## Interior lift: the pick measured (2026-10-08, session 36 "3D Scene 26", CPU + SwiftShader, no GPU)

Built, NOT committed / pushed / pinned (waits on Fabio's call below): `MpiLiftDepth` sign convention
(`scene3d/lift.py`: negative = |z| in the fit AND kept; 0 = unknown, kept; positive = known, not
kept), `renderPicture` writes MINUS the pano's z on a hole that is a real surface seen from behind
(`COMP_FRAG` view 3), and Take picture sends those only for an INTERIOR shot (`knownDepth` in
`scenePicture.js`, the same > 50% switch as the prompt: outside, a back face is an object's far side
and Klein paints what lies beyond it).
- **Checks green:** MpiNodes `tests/test_scene3d.py` 10/10, +1 test (mutants killed: the old `zc > 0`
  rule -> "fewer than 2 known pixels"; negatives fit but not kept -> assert). `scene-picture.test.cjs`
  +1 (interior sends -z, exterior zeros it), scene unit tests 42/42. `scene-viewer.spec.js` +1: from
  outside the fixture sphere, the back face 1 ahead reads z -1, backFrac > 0.9 (mutant = the old `: 0`
  -> "got 0"). eslint clean.
- **Offline A/B on the window picture's real fill** (rig: session scratchpad `ab/`; Electron with
  hardware acceleration OFF, so no GPU and no lease while MPI-1036 held it; MoGe on CPU, 10 s). The rig
  reproduces session 35 exactly: holes at render 85.1%, the old known depth == the run's `.f32` (100%
  of the mask, z 1e-7), the CPU lift == the GPU run's layer (99.84% kept agree, z 0.01%), and all four
  cameras' own-camera holes with all layers 64.2 / 0.4 / 6.5 / 8.4%.
- **The pick alone does NOT reach < 15%:** window own camera **58.3%** (today 64.3%). Fit error goes
  2.2% -> **73%**. Why (`viz.png`): the back faces are ONE flat plane, the window wall 0.25 ahead
  (|z| p05-p75 0.23-0.28), but Klein painted a deep corridor ending at the opening (MoGe: the doorway
  ~2x farther than the walls round the frame). No scale + shift makes a corridor a plane.
- **What does pass** (window, own camera, its layer only):

  | lift | composite today | + a fill at a rejected surface wins (x1.03) | + back faces never hide a fill |
  |---|---|---|---|
  | today (fit on the view out) | 64.3% | 62.9% | 26.1% |
  | the pick (fit on walls too) | 58.3% | 57.2% | **13.0%** |
  | fill painted onto the walls (the wall's own z) | 80.2% | **2.3%** | 2.3% |

  "Back faces never hide a fill" leaves treetop / floor / behind_well unchanged (0.4 / 6.5 / 8.4%) but
  lets another picture's fill show through the house wall where the room fill does not reach
  (`all_window.jpg`, right edge). Painted-on-walls is exact at the camera and flat from anywhere else
  (`sheet.jpg`, moved camera). **Fabio picked A (2026-10-08).**
- **A shipped:** `COMP_FRAG` `take` gains `|| A0.z > 1.5` (a back face never hides a fill). Measured
  with the app's own shader (no rig override): window own camera **13.0%** holes (< 15%). Spec +1: 6
  out on the layers' ray at 300 mm the white fill 5.5 away shows through the sphere's back face 1
  away, z 5.5 (mutant = the old `take`: "got z -1.05"). `npm test` 2778 pass / 0 fail; scene desktop
  spec green; eslint clean. MpiNodes `3ec03ef` committed + pushed (on `6bf5659`), pinned in
  `dev_configs/node_lock.json`. **Left:** the window shot RE-TAKEN end to end on an isolated app
  under the lease, on an engine restarted onto `3ec03ef` (Fabio's 48188 still runs `6bf5659`).
- **Live re-take PASS (2026-10-08, session 37 "3D Scene 27", 4060 Ti, under the lease).** Fabio
  restarted his app at 15:34 local; the engine reinstalled MpiNodes `3ec03ef` (`.mpi_node_commit`
  15:34:29) and started after it (48188, pid 22640). Session 35's `take.cjs window` (own profile
  `cubric-agent-profile-64baa187`, own port, a fresh copy of the Convert test card + the spike's
  window rect): **79.6 s** (fill 47.9 / lift 11.2 / clean 19.8), one entry with `scenePose`, layers
  0 -> 1, no new card. The `ab/` rig on that manifest, the app's own shader, layer 0 at its own
  camera: **12.3% holes** (was 64.3%; offline 13.0%). Of those, 128,684 px have no layer at all
  (the lift's unkept pixels: a ~30 px strip down both frame sides + sky round the roofs) and only
  **120 px** are a fill hidden behind a wall (was 426k). By eye (`window_retake_sheet.jpg`,
  session 37 scratchpad): the room's walls, floor and door frame sit in the viewer; Klein still
  paints an open DOORWAY, not a shut window (INTERIOR has no window nouns) - Build here's SAM3
  glass + closed-window wording is where that changes. Rig: session 37 scratchpad `take.cjs`,
  `ab/`.

## Build here (2026-10-08, session 37 "3D Scene 27", 4060 Ti, under the lease)

Built (Fabio "go"): `buildHere` / `buildPoses` / `BUILD_MM` + `fillLayer` (Take picture's fill, now
shared) in `scenePicture.js`, `PITCH_MAX` exported from `sceneViewer.js`, a **Build here** button in
`MpiSceneBlock`'s tools strip (Stop on a second press; Take picture and Build here lock each other).
- **Checks green:** `scene-picture.test.cjs` +2 (six poses in order, square, 16 mm, INTERIOR, a full
  view skipped, no clean-up / entry, a layer per filled view; Stop finishes the running view and
  starts no other) - mutants killed: no stop check, no skip, up/down untilted. `npm test` 2780 pass /
  0 fail. `scene-workspace.spec.js` (two tools; Build here off while no scene loads) and
  `scene-viewer.spec.js` green - the spec caught a real bug: `MpiButton.mount` REPLACES its
  container, so the second button in `#tools` wiped Bake 3D (now one slot each). eslint clean.
- **Live, window spike camera** (session 37 scratchpad `build.cjs`: a fresh copy of the Convert test
  card, Build here, then Take picture out of the window and turned 180 into the room): **264.7 s**
  for 6 of 6 views (fill 37-47 s, lift ~2 s each; target <= 6 min). Then the window picture 66.8 s,
  the room picture 66.3 s, one entry each, 8 layers, no new card.
- **Holes with the BUILD's layers only** (`measure.py`, the `ab/` rig, app shader): window frame
  **1.9%** (85.1% at render before), room frame 5.3%, the six views 0.5 / 1.8 / 4.2 / 2.0 / 0.2 /
  1.8%. Left holes are thin rims round plants and the window frame edge. With the two pictures' layers
  too: window 0.4%, room 1.5%.
- **By eye** (`build_sheet.jpg`): a coherent room round the camera; both pictures agree on it (the
  plants and wall behind). BUT Klein paints a **modern photoreal apartment** (beige walls, oak floor,
  pot plants, a TV, skylights) inside a stylised cartoon cottage: the first view is mostly black and
  INTERIOR's "match the existing image" does not carry the style. The down view reads as a courtyard
  seen from above. The opening is still a doorway (SAM3 glass not in). Fabio's eye: open.
- Exported for Fabio to fly: `Documents/Cubric Studio/Projects/MPI-623 Build here - window`.
- **Live, behind_well spike camera** (outdoors, same rig, `BUILD_CAM=behind_well`): **295.2 s** for 6 of 6
  views; the behind_well picture 79.6 s, turned 180 91.9 s. Holes with the build's layers only: the
  behind_well frame **6.3%** (75.8% at render in session 35), turned 180 7.3%, the views 6.6 / 9.4 /
  5.0 / 6.6 / 0.5 / 0.1% - sky round the tree crowns (the lift keeps no sky) and the near ground. By
  eye (`build_sheet_well.jpg`): the village's own style everywhere, both pictures agree. Exported:
  `Documents/Cubric Studio/Projects/MPI-623 Build here - behind well`.
- **Interior style: the pano as Klein's reference image 2 (Fabio's idea), bench A/B** (session 37
  scratchpad `abref/`, sheet `abref_sheet.jpg`; the app's Klein 9B graph wf 5 on the bench, title
  injection, `Input_Image_2` = the pano at 1440x720 - the graph scales a reference to 1 MP with
  NEAREST, and MpiLoadImage reads only inside input/ output/ temp/). Build view 1 at the window spot
  (96% holes, backFrac 0.78). A = INTERIOR today; B = + pano ref + a style-only line ("paint the
  room in exactly its style ... put nothing from image 2 inside"); C = + pano ref alone. Seeds 42, 7.
  **Result:** the reference warms the light and palette (golden light, warm wood, mouldings; A is
  grey-beige) and copies NO village content into the room - but all six stay PHOTOREAL; none takes
  the cartoon rendering. B == C by eye. Cost **+19 s a fill** (48 s vs 27-30 s), ~+2 min a build.
  Not wired. The rendering style needs words, not a picture: a style phrase from the pano (a
  caption, or the user's fill line), or Klein's style rack - Fabio's call.

## Fly-through feedback + panel fixes (2026-10-08, session 38 "3D Scene 28", no GPU)

Fabio flew `MPI-623 Build here - behind well` (three screenshots). His asks: the gallery always
shows the pano; Shift flies faster; a stepped lens slider, not a dropdown; how do the presets
(Forest / More houses / Open fields) generalise; a floor under the floor above the well; the
pictures "not looking good".
- **Built:** the card stays on its pano (`savePicture` keeps `selectedIndex`; a picture pick in the
  list no longer writes it; opening Scene resets a card left on a picture). Shift = `FLY_BOOST` x4
  (`scene.fly.boost` + a `.shift` twin per fly letter, which also stops `shift+w` leaving W held).
  Lens = `MpiProgressBar` stepped over 12/14/16/20/24/28/35/50/85 with the length beside it.
  Presets removed (they named the spike village; the free line stays) - my pick on his question.
- **Checks:** scene unit tests 26/26 (+1: boost x4, roll unboosted); `npm test` 2790 pass / 0
  fail; `scene-viewer.spec.js` (card reset to the pano on open and kept on a picture pick, Shift+W
  > 2.5x W in 400 ms and stops when released under Shift, the slider's 35 mm / 12 mm) and
  `scene-workspace.spec.js` green. Mutants killed (`scripts/mutate-check.mjs`): boost ignored, no
  reset on open, no `.shift` twins. eslint clean.
- **Screenshots 2-3 are the LIVE view at the pictures' cameras, not the pictures:** `scene_001` /
  `scene_002` are whole and in the village style (scratchpad `well_pictures.jpg`). The dark rims are
  holes: torn depth edges and the sky the lift keeps out. Showing them is plan A1 ("the viewer IS
  the shot"); whether flying should paint them over is Fabio's call.
- **The floor under the floor (screenshot 1), measured offline** (session 38 scratchpad `floor.py`,
  `fit.py`, on the exported project's manifest + preview-asset `.f32`s): the pano's ground is level
  (y 0.46 at the camera -> 0.51 at r 1.5); the build camera sits 0.23 above it. Each side view's
  bottom quarter (floor the pano never saw) is lifted at **3.05 / 2.95 / 2.37 / 6.01x** the flat
  ground's depth (medians, views 1-4); layer 3's floor is 1.0 below the pano's. The down view's
  known depth is the render of those layers (median z 0.73 against 0.23 true; its centre a hole), so
  it fits to them and sinks too (`down_view.jpg`). Root: `MpiLiftDepth` fits `z = a * MoGe + b` on
  the known pixels, which are mid/far geometry, and extrapolates to the near floor. Not a viewer bug.
- **Interior style, describer A/B** (Fabio: "go with your pick", the describer = whatever Remote
  picks). Session 38 scratchpad `abstyle.py` on the bench under the lease, same build view 1 /
  seeds as `abref`. The ComfyUI describer (Qwen3-VL, 9.0 s) on the pano, asked style only: "The
  image employs a low-poly, stylized 3D rendering with flat, geometric surfaces, soft gradient
  shading, and a warm, earthy color palette that emphasizes simplified forms and minimal detail."
  D = INTERIOR + "The style of the picture: <that>" (27-33 s); E = D + the pano as image 2 (48 s).
  **Result** (`abstyle_sheet.jpg`, beside A and C): D and E are no longer photoreal - flat walls,
  soft gradients, no wood grain or pot plants, the scene's warm palette - but bare (the phrase says
  "minimal detail"). E == D by eye at +19 s. D wins. Wired: `STYLE_ASK` + `sceneStyle` in
  `scenePicture.js` (once a scene through `io.describe` = `describeImage`, INTERIOR only, a failure
  stops the fill before Klein with a Remote > Language Models hint, Scene status "Reading the
  scene's style..."). Unit 11/11 (+3: asked once a scene with the pano's path, never outside, a
  failure enqueues nothing); mutants killed: no cache, phrase dropped, failure ignored, asked
  outside too.
- **Live re-run 1, window spot** (session 38 scratchpad `build.cjs` -> `build_style/`, own app on
  its own port, engine 48188, under the lease): style read once 15.7 s (ComfyUI describer), build
  263 s, window picture 63 s, room picture 61 s. The front view, the up view and the window picture
  came out in the scene's flat style - but the right / behind / left / down views and the room
  picture are a PHOTOREAL OPEN COURTYARD (sky, palms, plaster) inside the cottage
  (`style_build_sheet.jpg`). The fills' sidecars say why: those five ran GENERIC, the other three
  INTERIOR + style. **Root:** INTERIOR was a per-FRAME switch (`backFrac` > 0.5 of the frame seen from
  behind); inside the cottage the side views see mostly NOTHING (the pano never saw those walls), so
  they read as outside, and GENERIC's "walls, ground, sky, plants" painted a courtyard. **Fix:**
  `insideAt(view, renderer, pos)` decides per SPOT - six 48 px views round it, more pano seen from
  behind than from the front (`renderPicture` now returns `frontFrac`, from the composite's free
  view-3 b channel: a real pano surface seen from the front; layers never count). Build here asks
  once for all six views; Take picture once per picture; `knownDepth` follows the same answer.
  Checks: unit 25/25 (`insideAt` cottage vs well, one answer per build, asked at the camera's
  spot); `scene-viewer.spec.js` (front share ahead > 0.9, 0 from outside; `insideAt` false at the
  fixture's centre, true 6 out behind its wall) + `scene-workspace.spec.js` green; `npm test`
  2793 / 1 fail = `user-flows.test.cjs` "every shipped Flow ... validates" on `tile-detailer`
  (a peer's uncommitted Flow in `flowsRegistry.js`, not this card). Mutants killed: the shader's
  front channel zeroed (spec), `insideAt` always false, the build's answer forced false (unit).
- **Live re-run 2, window spot** (`build_style2/`, `style_build_sheet2.jpg`): `insideAt` on the real
  scene for every spike camera = window **true**; treetop, floor, behind_well, walk0 **false** (so
  behind_well's build is unchanged: GENERIC, as in session 37). Build 255 s, pictures 61 / 59 s; all
  eight fills INTERIOR + style (sidecar `prompt`). No courtyard, no photoreal anywhere. **New flaw:**
  every view that sees no outside (right / behind / left / up / down) got a blank WHITE opening, and
  the room picture is mostly a white doorway. INTERIOR speaks of "the bright areas ... outside ...
  its openings" and "the frames around the openings": with nothing outside in the frame, Klein
  invents an opening and leaves it white. Bench A/B of a closed-room line queued (`abclosed.py`).

## Fabio's three picks: gaps on screen, the ground plane, presets out (2026-10-08, session 38)

Fabio: "go with your picks on all three".
- **Closed-room wording** (`abclosed.py` on the bench, run 2's view 2 + 3 frames, 91% / 97% holes,
  `abclosed_sheet.jpg`): F = INTERIOR + style reproduces the white doorway (both views); G = `ROOM`
  ("walls, the ceiling and the floor", no openings, no bright areas) + style = a closed room in the
  scene's flat style, both views, seeds 42 / 7. Wired: inside, a frame whose pano-from-the-front share
  is <= 1% (`SEES_OUT`) fills with `ROOM`. Unit +1; mutant (always sees out) killed.
- **Gaps on screen:** the composite paints a hole the pano drew any face in with that face
  (`uGaps`, set on every canvas draw, 0 for `renderPicture`'s target), so flying shows the stretched
  pano / a wall from behind instead of dark rims; Take picture still gets the hole. Spec: the tear
  reads the band's colour on screen, alpha 255, while `renderPicture` at the same pose has the hole
  (mask 255). Mutants killed: gaps never painted, gaps painted in the picture too.
- **Presets:** stay removed.
- **The ground plane** (the sunk floor). MpiNodes `87d7962` (pushed, pinned in
  `dev_configs/node_lock.json`): `MpiLiftDepth` takes an optional `ground` 'nx,ny,nz,d' (camera
  frame) and moves a kept pixel the fit put past it onto it (`ground_depth`, `lift_depth(floor=)`);
  `tests/test_scene3d.py` 12/12 (+2: a level camera's ground rows; a sunk floor lifted onto the
  plane, nothing above it moved, and sunk without it); mutant (no clamp) killed. App:
  `view.groundAt(x, z)` = the median y of the 800 pano cells nearest the spot in plan, of those
  looking down and within 12% of `groundBelow` - the pano's ground is not level (behind_well 0.505
  at the spot vs 0.455 under the camera) and inside the cottage the nearest down-looking cells are
  the facade (0.38 without the band, 0.46 with); `groundPlane(record, groundAt)` -> `Input_Ground`
  (a core `PrimitiveString`: an `MpiString` would be staged as a file). Units: groundAt on a sloped
  synthetic pano + a wall beside the spot (band mutant killed at 1024x512; at 256x128 it never
  shows); groundPlane on behind_well's real down-view record = camera 0.228 above the ground
  (sign mutant killed); scene-ops: `Input_Ground` is no path node, feeds `ground`.
  **Offline on behind_well's real layers** (JS `groundPlane` -> the node's own `ground_depth`,
  `plane_check.mjs` + `clamp_check.py`): side views level, camera 0.225 above the ground, up view
  never meets it, down view straight at it. Views 1-4 bottom quarter, layer/ground median **3.10 /
  2.99 / 2.41 / 6.09 -> 1.00** (exactly the new node's output: the clamp runs after the fit). BUT
  61-84% of each view's kept fill moves - the whole near field was too deep, so a near object would
  lie flat on the floor rather than sink under it. Next if it shows live: refit with the floor in it.
- Checks: `npm test` 2796 / 1 fail (the peer's `tile-detailer` Flow, unchanged); scene specs green;
  eslint clean; `scene.py` compiles. **Live run waits on the engine running `87d7962`** (Fabio's app
  restart reinstalls pinned nodes, as for `3ec03ef`).
- **Live, both spots** (Fabio restarted 22:37 UTC; app log: node drift 3ec03ef -> 87d7962 wiped +
  reinstalled; `/object_info/MpiLiftDepth` lists `ground`). Session 38 scratchpad `run_both.sh`
  under one lease, fresh card each, `analyze.py` -> `well_ground/sheet.jpg`, `win_ground/sheet.jpg`.
  behind_well: build 247.5 s, pictures 65 / 64 s; all eight fills GENERIC (outside, as before);
  ground under the spot 0.505, camera 0.225 above; **0.0% of any layer under the ground**; the side
  views' near floor on it (layer/ground 1.00 front / behind / left). Window: build 253 s, picture 61 s,
  the room picture 17 s (no holes left: clean-up only); fills = front INTERIOR + style, the five
  others ROOM + style, the window picture INTERIOR + style; 0.0% under the ground; a closed room in
  the scene's flat style, no white doorways. The live views at both pictures show no dark rims
  (`uGaps`). **Left by eye:** (1) behind_well's DOWN view is a walled courtyard with sky - Klein does
  not know the frame looks straight down - laid on the floor, which shows from above; (2) the room's
  floor sits ABOVE the outside ground (layer/ground 0.37-0.80: the interior fit, the compromise of
  § Interior lift; the clamp only lifts what is under the ground); (3) turned 180 inside, the room's
  back wall fills the frame (a small box room). Exported for Fabio: `MPI-623 Ground - behind well`,
  `MPI-623 Ground - window`.

## The straight-down wording (2026-10-09, session 39 "3D Scene 29", 4060 Ti, under the lease)

Fabio: "go" on a straight-down line for Build here's DOWN view (pitch -PITCH_MAX).
- **A/B** (`abdown.py` + `abdown_sheet.py` in session 39's scratchpad, bench 8188, Klein 9B wf 5, seeds
  42 + 7, ~30 s a fill, out `D:/WORK/Images/Outputs/mpi623_down/`): the 6th square frame of session 38's
  `well_ground` (outside, 79.7% holes) and `win_ground` (inside, 85.2%). Outside: GENERIC = a walled
  courtyard with sky, BOTH seeds (the fault, reproduced); `DOWN` ("a top-down view, looking straight
  down at the ground ... flat and level") = flat ground seen from above with the well's shadow, both
  seeds; `DOWN` + "no sky, no horizon and no wall" = the same, so the plain line is kept. Inside: ROOM
  + style = a box room seen LEVEL (walls, ceiling, back wall), both seeds - the same fault, inside;
  `FLOOR` + style ("looking straight down at its floor ... seen from directly above") = the floor from
  above, both seeds (s7 a wall strip at one edge, continuing the frame's wall).
- **Wired:** `fillPrompt(..., pitch)`: a view pitched down past 60 degrees (`LOOKS_DOWN`) fills with
  `DOWN` outside, `FLOOR` + style inside; the call site passes the shot's `pose.pitch`, so a Take
  picture aimed at the ground gets it too. `docs/scenes.md` step 2 says so (kept at 200 lines).
- **Checks:** `tests/scene-picture.test.cjs` 15/15 (+1: -61 deg DOWN, -59 deg GENERIC, +61 deg GENERIC,
  inside -89 deg FLOOR + style, -59 deg ROOM, Take picture at -75 deg; the Build here test now expects
  FLOOR on its down view). Mutants, each killed: the call site drops the pitch; looking UP counts as
  down; inside never gets FLOOR; outside never gets DOWN. eslint clean.
- **Live, both spots** (session 39 scratchpad `run_down.sh` = `run_both.sh` into `well_down` /
  `win_down`, one lease; `analyze.py` there knows DOWN / FLOOR): behind_well build 207.7 s, pictures
  50.7 / 49.1 s, fills GENERIC x5 + **DOWN** on view 6 + GENERIC pictures; the down layer is flat
  flagstone ground seen from above with the well's shadow (no courtyard, no sky); 0.0% of any layer
  under the ground, layer/ground 1.00. Window: build 205.9 s, fills INTERIOR / ROOM x4 / **FLOOR** on
  view 6 (the floor from above, a thin wall rim at its edges), picture 1 48.9 s, 0.0% under the ground.
- **FOUND, not from the wording: the window's room picture (turned 180) FAILED** -
  `MpiLiftDepth failed: ValueError: lift: fewer than 2 known pixels`. Its frame was 100% holes with no
  known depth at all, because build view 3 (behind - built BEFORE the down view, same prompt as session
  38) kept only 6% of its fill (session 38: 95%). Cause, `scene3d/lift.py:52-58`: the fit `z = a*zm + b`
  ran on view 3's only known pixels, a 106 px strip of view 2's wall seen edge-on, all ~0.13 deep (no
  depth spread) -> the slope is ill-conditioned, the back wall's `za` comes out <= 0 and is dropped.
  Run-to-run Klein variance in views 1-2 decides whether that strip is all view 3 sees. Two open
  halves: (1) the fit on a known set with no depth spread; (2) Take picture on a frame that sees
  nothing errors with the node's raw ValueError.
- **Fixed, Fabio "let's try that approach"** (my pick: scale only, plus a plain stop):
  - **Offline repro first** (`liftrepro.py`, session 39 scratchpad: CPU MoGe on each build view's real
    fill + its known `.f32`, through the repo's own `lift_depth`, zm cached in `zm_cache/`): matches
    live exactly (win_down view 3 kept 6%). Over 18 build views (win_down, win_ground, well_down) the
    fit pixels' MoGe depth p90/p10 is 1.31-6.60 on every healthy view; the two degenerate ones are
    win_down view 3 (1.02, a = -2.712, b = +1.548) and session 38's win_ground view 3 (1.03, a = +0.635
    by luck, kept 95%).
  - **MpiNodes `972dc22`** (pushed, pinned in `dev_configs/node_lock.json`): `lift_depth` fits
    `z = a * zm`, a = the median ratio, when p90/p10 < `flat` (1.05) or the slope is <= 0.
    `tests/test_scene3d.py` 14/14 (+2: one depth known with a negative noise slope - the back wall kept
    where it stands; one depth with a steep positive slope (a = 100, the wall 27x too far), and a
    spread set with a negative slope). Mutants killed: no guard; slope check only; spread check only.
    Re-run offline: win_down view 3 kept 6% -> **90%** (back wall at 0.38; session 38's lucky run put it
    at 0.44), win_ground view 3 95% -> 99%, the other 16 views identical (a, b, kept).
  - **App:** `fillLayer` stops before the describer and Klein when the frame has no known z at all
    ("nothing of the scene is in this view to fit the fill to. Turn the camera toward the scene");
    back faces count as known. Unit 16/16 (+1); mutants killed: no check; back faces not counted.
  - `npm test` 2801 / 0 fail; eslint clean; docs/scenes.md step 3 (200 lines).
  - **Live, both spots, PASSED** (Fabio restarted; engine marker `.mpi_node_commit` = `972dc22`;
    `run_fit.sh` into `well_fit` / `win_fit`, `analyze.py`): window build 249.7 s, the window picture
    58.6 s, **the turned-180 room picture 15.0 s with no holes left** (behind layer kept 88%, was 6%),
    FLOOR on the down view, 0.0% under the ground. behind_well build 211.7 s, pictures 52.3 / 50.7 s,
    DOWN = hexagonal flagstones from above, 0.0% under the ground. Open by eye: behind_well's up view
    has a black blob in the rock; its behind layer's near floor reads layer/ground 0.51 (was 1.00) -
    maybe planters standing on it, maybe the guard fired there (check: `liftrepro.py well_fit`).

## behind_well's two by-eye items (2026-10-09, session 40 "3D Scene 30", CPU only)

Rigs in the session 40 scratchpad (`C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/1afa8c46-9a6a-4879-8dc4-13b620d674cc/scratchpad`):
`upblob.py` / `upblob2.py` / `leakscan.py` (the blob), `floatmap.py` (z / ground per pixel), `abfit.py`
(A = today's fit vs B = scale-only always, through the repo's `lift_depth` with the live ground plane as
`floor`; zm cached in session 39's `zm_cache/`). Results `abfit_seam.txt`.

- **The up view's black blob = black left in Klein's own fill**, not the lift or the viewer: the same
  2.05% dark pixels in `inpaint_005.png` and its layer, sitting in the middle of the frame's biggest hole
  (Klein drew a rock lip round it, so it reads as a cave mouth). One-off: over 36 build fills (6 runs)
  every other fill leaves <= 319 dark px in its holes; this one 20,657.
- **The behind layer's 0.51 = the whole near floor floating, not planters, and the guard did NOT fire**
  (p90/p10 1.52, a = +1.020): the affine fit's intercept b = -0.318 tilts the floor up toward the
  camera, rows 819 to 1023 at 0.69 down to 0.13 of the ground's depth (`floatmap.py`). The ground clamp
  is one-sided (only under). Session 38's run of the same view had b ~ 0, so 1.00; run-to-run Klein
  decides. Offline A reproduces it exactly; well_ground view 2 (right) has it worse (A: floor 0.08,
  kept 21%).
- **A vs B, outside (behind_well, 18 views):** B puts the near floor on the ground on all 18 (A fails 2);
  seam error (median |za - z| / z on known pixels within 24 px of the holes) B better on 11, equal 4,
  worse on 3: both front views where A's fit was good (0.071 to 0.208, 0.052 to 0.171) and one down
  view (0.015 to 0.047). Every floating view has b < 0; every b > 0 sink is already caught by the clamp.
- **Inside (window, 18 views): neither fit puts the room floor on the ground** (A 0.36-0.96, B
  0.40-0.84) and seams are poor both ways (0.05-0.62); B is worse on the side views. That is the next
  item's own mechanism (the room floor above the outside ground), not the outside float.
- **Floor-aware fits** (`abfloor.py`, `abfloor.txt`; floor = hole pixels whose MoGe surface faces along
  the plane normal, below the camera; target z = the ground's): C = affine, scale-only when b < 0;
  D = scale-only over known + floor; E = affine over known + floor.
  - Outside: **C is never worse than A** on 18 views, fixes both floats (0.51 / 0.08 to 1.00) and
    improves 5 seams. D / E cost the front views' seam (0.05-0.07 to 0.22-0.29) - no gain over C.
  - Inside: pinning the room floor to the ground puts the walls off about 2x (down views: floor
    0.63-0.77 to 0.93-1.00, seam 0.48 to 1.0-1.3). **No one-scale fit can put Klein's room on both the
    house walls and the ground** - the room it paints is not the house's size. C inside is mixed (front
    seams better, side seams worse: 0.10-0.34 to 0.28-0.58).
- **Fabio: "go with your picks"** - C outside only; the room floor waits on his fly-through eye; the
  blob is left (1 in 36).
  - **MpiNodes `db3bdc7`** (pushed, pinned in `dev_configs/node_lock.json`): `lift_depth` also fits
    scale only when the shift is < 0 on a frame with no back-faced known pixels. `tests/test_scene3d.py`
    15/15 (+1: a far wall whose fit shift is -0.5 - outside the near floor lands >= 0.85 of the
    ground's depth, b = 0; the same frame with back faces keeps a = 2.5, b = -0.5). Mutants killed
    (`mutants_shift.py`): no shift rule; inside too; sign flipped.
  - **Offline on the 36 real views through the repo's own `lift_depth`** (`abfit_new.txt`): exactly the
    5 outside views with b < 0 change, all better (well_fit 3: floor 0.51 to 1.00, seam 0.074 to 0.048;
    well_ground 2: floor 0.08 to 1.00, kept 21% to 52%); 2 inside views that see no back face change
    too (win_fit 3 seam 0.293 to 0.307, win_fit 6 0.476 to 0.421) - written as a ponytail in the
    docstring. App lock tests (node-drift, engine-drift, curated deps, download) 35/35.
  - **Live after Fabio's restart** (marker `db3bdc7`; `run_shift.sh` -> `well_shift` / `win_shift`):
    behind_well build 248.9 s, pictures 59.8 / 60.1 s, every near floor 1.00, 0.0% under the ground.
    Weak proof of the rule: live it fired only on view 3, whose plain fit had b = -0.000 (`whyfit.py`);
    the offline 5 views stay the evidence. **Two new failures found:**
    - **Window: Build here FAILED at view 3** ("nothing of the scene is in this view"). Not the rule:
      views 1-2 see back faces, plain fit (`whyfit.py win_shift`). Inside the house the view behind sees
      only what views 1-2 built; this run's view 2 fill sat nearer (b -0.682 vs -0.436, kept 61% vs 75%)
      and reached none of view 3's frame. Session 39's pass hung on a 106 px strip. **Fixed (app):**
      `buildHere` sends a view with no known z to the back of the queue once; still blind -> skipped,
      its holes left for Take picture. Unit (+1, `z` per render in the harness), 4 mutants killed
      (`mutants_wait.py`): no wait; endless wait; skip at once; retry first.
    - **behind_well's down view: 8.55% of the frame left BLACK** (89,639 px, a square) - the second leak
      in two runs (2 of the last 12 behind_well fills), so "leave it" no longer holds. **Fixed (app):**
      `fillLayer` measures the fill's black inside the holes (`blackLeft`, mask white, max channel < 20)
      and over `LEAK` 0.5% fills once more (each job draws its own seed - every live sidecar differs).
      On the 38 real fills on disk it fires on exactly the 2 leaks (healthy <= 0.15%). Unit (+1), 5
      mutants killed (`mutants_leak.py`).
  - **Live, both fixes, PASSED** (`run_wait.sh` under the lease -> `well_wait` / `win_wait`,
    `analyze.py`, `retryscan.py`): behind_well build 194.5 s, pictures 47.3 / 74.4 s - **the retry
    fired**: picture 2's first fill left 2.47% black in its holes, the second 0.00% (the third leak in
    three behind_well runs); every near floor 1.00, 0.0% under the ground, no black on the sheet.
    Window build 192.8 s (view 3 saw view 2's layer this time, so the wait was not needed live - unit
    only), window picture 47.3 s, room picture 14.3 s with no holes; room floor 0.34-0.92 (the open
    interior item).
  - `npm test` 2822 / 0 fail (both fixes in); eslint clean; docs/scenes.md steps 2-3 + Build
    here (200 lines).

## Paths P1: the camera path editor (2026-10-09, session 40, no GPU job)

Fabio flew `MPI-623 Fixes - window`: side-stepping inside tears the Build here layers ("way too
much kung fu"); he picked the path route (plan § Plan Drift 2026-10-09). His reference clip (4 s,
`/watch`): a 360 video walking down a street, through a lit window, into a room Wan invented.

- **Built:** `js/services/scene/scenePath.js` (`addPoint`: an empty path starts at `PATH_START`, the
  pano's centre - Wan's video starts from the pano; a press within 5% of the camera height of the
  last point adds nothing; `removeLast`: down to the start = no path). `view.setPath(points, colours)`
  in `sceneViewer.js`: low-poly balls (`PATH_BALL` 0.12 of the camera height, ~20 cm) joined by
  thin tubes (a WebGL line is 1 px whatever its width), drawn after the composite on SCREEN only,
  depth cleared first so the scene never hides them, never in a picture. MpiSceneBlock: a Path
  section (Add point / Remove last / Clear + a count or the hint), hotkey **P** (`scene.path.add`,
  Scene page only), colours from `--accent-frost` (start) / `--accent-heat` through a 1 px canvas
  (three cannot read oklch). Saved on the pano item's SIDECAR (`update-meta`, `cameraPaths:
  [{ points }]`) and mirrored on the live item: project.json keeps item ids only, so `updateGroup`
  alone saved nothing (caught by the rig, fixed).
- **Checks:** `tests/scene-path.test.cjs` 3/3; scene/hotkey tests 43/43; `npm test` 2825 / 0 fail
  (before the sidecar + tube changes; related tests re-run after); eslint clean. **Live**
  (`path_check.cjs`, session 40 scratchpad, isolated app, staged test card): P at the pano centre,
  behind_well and the window -> 3 points, a 4th P on the same spot ignored; saved to the sidecar;
  navigate away and back -> the same 3 points; Remove last -> 2; Clear -> 0 and `[]` saved; no page
  errors. Screens `path_out/views.jpg`: cyan start ball, rose balls + tubes, visible from above, the
  side and the start.
- **Fabio's eye: "1" - PASSED.** Then P2: render a path with Wan.
- **Test projects merged (Fabio's yes):** `Projects/MPI-623`, three named cards (Convert test as is;
  each Fixes run a new card id, a new pano id, `well_` / `win_` file prefixes, only what its card
  uses). 24 file refs, 0 missing, no old path left; opened in the isolated app: all three scenes
  load (0 / 8 / 7 layers) with their pictures, no page errors. The seven old folders went to the
  Recycle Bin, not deleted. Two script bugs caught by its own checks before anything was removed:
  stale fill-job sidecars from the shared scratch staging, and a late-binding closure.

## Paths P2: the guide video (2026-10-09, session 41 "3D Scene 31", WebGL only; Wan under the lease)

- **Unit:** `node --test tests/scene-path.test.cjs tests/scene-viewer.test.cjs` 22/22. Mutants (all
  killed, `mutants_p2.py`, session 41 scratchpad): mirrored frame, upside-down frame, first face
  instead of the best, heading snapping at a bend (TURN 0), uneven speed.
- **Live guide** (`stage.py` -> scratch copy `MPI-623 P2`, the Convert test pano given the window
  card's rect; `guide.cjs` in an agent app, own profile + port): path
  `[[0,0,0],[0,-0.1,-0.45],[0,-0.145,-0.79],[0,-0.145,-1.25]]` (window centre 10.5 deg below,
  0.79 units = 2.8 m; the window is ~0.46 m square, ground 0.455 units = 1.6 m). 81 frames in
  35 s (6 x 512 px views a frame, 0.2-0.7 s each). Holes: frame 0 5.0% (sky-band cuts round the
  tree crowns), 20: 9.2%, 40: 44%, 50: 73% (at the window), 60-80: 98-99.7% (inside: only the
  window behind shows the street, at the seam). Frame 0 by eye = the pano rolled to face the
  house (yaw pi). Sheet: `p2_window_sheet.jpg`.
- **Wan fill** (`p2_wan.py` under `gpu_lease.py run --poll 2`, bench :8188, the amendment-32 graph
  with node 27 swapped for our frames): `success` in **1700 s (28 min)** on the 4060 Ti, Q4 GGUF.
  Out: `D:/WORK/Images/Outputs/mpi623_p2/window_00001_.mp4` (+ `window_guide_00001_.mp4`).
  `corr.py` (amendment 31 gate, known pixels only): frames 0-50 **+0.95-0.99**, 60: +0.88, 70:
  +0.72, 80: +0.68 (1% known there: the window behind), min +0.62, **median +0.972** (the bake
  rail: 0.86-0.93). Its "black left" column (sum < 24) reads 40% at frames 40-50: by eye that
  is the dark warm shading of the invented interior, no black hole is visible in any frame. By eye:
  street -> round window -> a cosy wooden room (beamed ceiling, round windows, shelves, sunlight
  on the floor), the street still behind through the window at the seam, the passage coherent
  (frames 52-64, `p2_window_passage.jpg`). Previews sent to Fabio as VP9 WebM.
- **Fabio, 2026-10-09: "Awesomeness. 1"** - P2 guide + Wan fill passed by eye. Next: wire it into the app.

## Paths P2 LIVE: the real Render path button (2026-10-10, session 42 "3D Scene 32")

- **Engine** (Fabio restarted his app): :48188 `/object_info` has `UnetLoaderGGUF` + `MpiWanMaskedVideo`,
  the GGUF list shows `wan2.1-i2v-14b-720p-Q4_K_M.gguf`. CI on `902c72e2` (the wiring commit) green, run 38004455946.
- **Run** (`p2_live.cjs`, session 41 scratchpad, under `gpu_lease.py run --poll 2`; agent app, own profile + port,
  scratch copy `MPI-623 P2`): plugin `scene-path` installed, nothing missing; the real button clicked; the guide
  (81 frames) rendered in ~30 s; Wan landed `cameraPathVideo_001` (op `scenePathVideo`, 1440x720, 81 frames @ 16
  fps, 5.06 s) in **1810 s** through the generation queue; zero page errors. Prompt = scene style line + fill line.
- **Score** (`split_guide.py` + `corr.py`, session 42 scratchpad): known corr frames 0-40 **+0.97-0.99**, 50: +0.94,
  60: +0.89, 70: +0.74, 80: +0.62, min +0.54, **median +0.975** (bench +0.972). Holes per frame identical to the
  bench guide (5.0 / 9.2 / 44 / 73 / 98-99.7%). Frame 0's 47% "black left" = the dark tree outlines inside its
  sky-cut holes; by eye frame 0 is clean.
- **By eye:** street -> the house -> the round window -> a warm room with beams, a fireplace, shelves and a wall
  lamp (the fill line followed), the window behind at the seam. `live_sheet.jpg`, `p2_live_wan.webm`,
  `p2_live_guide_vs_wan.webm` (session 42 scratchpad), sent to Fabio.
- **Card for Fabio:** copied into `Projects/MPI-623` as `Path - into the cottage` (`add_card.py`: 4 cards, 5 refs,
  0 missing). The gallery shows a generated video card with NO name label (the imported cards show theirs).
- **Fabio, 2026-10-10: "All in all, the video looks good. It proved that it can do interiors like we
  expected."** - P2 live passed by eye. It plays as a FLAT equirect video in the app; looking around
  inside it is P3 (a playable 360 video card).
- **Fabio found a P1 bug (2026-10-10): a point added high up "keeps moving as I move the camera",
  stationary only near the other points' height.** Cause: path points are pose spots (y up, the fly
  keys' axis) and `applyPose` flips y into the y-down world the scene is meshed in; `setPath` drew the
  balls at the RAW spot, so a point h above the pano camera showed h BELOW it, under the ground, and
  (drawn over the scene) slid against it. Render path was never affected (its frames go through
  `applyPose`). Fix: `poseToWorld` shared by `applyPose` and the new `pathMeshes` (balls + joins).
  Sweep: `insideAt` / Build here / Take picture / Render path all pose through `applyPose`; the balls
  were the only bypass. Test "a path ball sits where the camera stood" (3 points incl. 2.1 up, a
  pitched + yawed camera); mutant (raw spot) killed. `node --test` scene-viewer + scene-path +
  scene-path-video 26/26, eslint clean.

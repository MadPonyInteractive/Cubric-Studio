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

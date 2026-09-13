# MPI-744 Checklist

LoRA facts and open decisions live in the card description; do not repeat them here.
App wiring ran in the same session as MPI-747 (`Output_Display`) at Fabio's call, 2026-09-13 —
the Klein graph is that card's live test. Ownership: `files.json`.

## Bench round 3 — the seam fix (2026-09-13) — READ FIRST, supersedes 3, 16 and 17

Measured on 8188 with `research/seam_bench/` (queue a variant of run #97's graph, same seed, then
score the seam in source space; sampling is deterministic run to run, so any pixel diff is wiring).

- [x] 19 - **The fix, as wired in Fabio's bench file** (`G:\ComfyUi\ComfyUI\user\default\workflows\flow_head_swap.json`):
  change = `ImageBlend` difference both ways -> `screen` (= abs) -> `ImageBlur 2/1.0` -> R+G+B `ImageToMask`
  summed with `MaskComposite add` -> `ThresholdMask 0.18` (Klein's darkening sums to ~0.07); gate =
  BiRefNet(new decode) + BiRefNet(old crop), `GrowMask 60`, multiply; plus old-person MINUS new-person
  (hair that went); `GrowMaskWithBlur 12/12`; `ImageCompositeMasked` decode onto the ORIGINAL crop
  -> stitch. Expand return: crop `mask_expand_pixels` = `MpiMath floor(a * 0.12 + 0.5)` of the box
  width, `context_from_mask_extend_factor 1.1`. Plate pass and `MpiInpaintHeal` removed.
- [x] 20 - Results (seam band median, bg / body / region edge): dark 0/0/-1, cat 0/0/0, red 0/0/+1.
  Box return cut the new hair at the box bottom; expand return fixed it. Green-only threshold left
  holes where red hair became brown (old hair showed through) -> RGB sum fixed it.
- [x] 21 - ColorMatch mkl wired exactly as Draw It In (ref = crop, target = decode): bg seam still
  -7/-5/-3 and the head changes (7.7) — measured, not assumed. Fabio's "ColorMatch is crap" was
  experience, not a rule (he said so); the feedback memory needs rewording — ASK before editing it.
- [x] 22 - Klein 4B distilled + BFS 4B 0.75: clean on dark/cat, fails red (mask holes, light halo)
  and loses identity -> **DROPPED, ship 9B only** (Fabio 2026-09-13).
- [x] 23 - Base 9B / turbo LoRA (anyMODE `klein_9B_Turbo_r128`, = distilled minus base): 0.25/8st/CFG3.5
  130 s and 0.5/16st/CFG2.5 257 s both still darken -5..-7 (distilled int8: -7/-6/-6 in 23 s).
  CFG > 1 NEEDS an empty-text `CLIPTextEncode` negative carrying the same ReferenceLatents —
  `ConditioningZeroOut` overcooks (50st/CFG4 run was garbage, 751 s). ComfyUI's own template
  `image_flux2_klein_image_edit_9b_base.json`: 20 steps, CFG 5, euler. Turbo for 9B = Fabio's call.
  **CORRECTION (2026-09-13, read after handoff):** base 9B AT the template (20 st / CFG 5 / euler,
  empty-text negative) darkens LESS raw on dark_box, 0/-2/-3 (bg |d| 2.83) vs distilled -7/-6/-6,
  but still shows the box edge by eye, and the region composite takes BOTH to 0/0/0 — at 297 s vs
  23 s. Base buys nothing once the composite ships. Sheet: 31cf502b scratchpad `bench_base20t/dark_box_zoom.png`.
- [ ] 24 - Queued runs READ: drag-in graph pixel-identical to the tested recipe (mean 0, max 0);
  `fill_holes` REJECTED on 9B (fills the region to the whole gated area, bg from the decode again:
  dark |d| 0.05 -> 1.68, cat 0.04 -> 0.71) — not applied.
  **Exported 2026-09-13:** Fabio's bench file -> `raw/flow_head_swap.json` (re-indented to 2-space,
  seam tail re-checked link by link: MpiMath <- Input_Box -> `mask_expand_pixels`, stitch <- 282),
  runtime via `workflow-to-api.mjs` on 48188 (59 nodes), `validate-injection-rules` + `verify-workflow`
  green. Prompt inline in untitled CLIPTextEncode 128 = nothing to wipe; placeholder paragraph gone.
  **Deps NOT added** (handoff was wrong): `birefnet` (engineAsset) and `comfyui-kjnodes` (custom_nodes)
  are universal engine deps, and `requiredDeps` is what the Flow's Uninstall frees. Live run pending.

## Bench round 4 — base 9B + turbo LoRA (NEXT SESSION, harness ready) — READ FIRST

Fabio 2026-09-13, from a face 2-up (base 20 st / CFG 5 vs distilled, dark photo, ONE seed): distilled
looks better and its expression is closer to the reference, but base has more face detail and slightly
better likeness, so base may be over- or undercooked. **Direction: ship base + turbo LoRA, IF the tests
hold.** One seed proves nothing; every phase runs several.

Read `docs/models/klein/9b.md` § What was benched and REJECTED before spending GPU: MPI-600 (2026-08-22)
rejected this exact LoRA for kleinEdit (base ~6-7x slower, 0/3 on reference placement, 0.7/0.35 WORSE
than 1.0). A different op, so not a verdict here, but shipping base means a second 9B weight
(`flux-2-klein-9b.safetensors`, NOT int8; distilled int8 already peaks ~15 GB on a 16 GB card) plus the
turbo LoRA, and neither is hosted. One data point exists: base + turbo 1.0 / 4 st / CFG 1, dark box,
36 s, raw bg shift -4/-9/-17 (distilled -7/-6/-6; the region composite hides raw shift either way).

Harness `research/seam_bench/bench_run.py` (knobs in its docstring: SEED, CFG > 1 negative built
automatically, FILL=0 default, DRY=1, writes `<tag>_face.png`) + `faces.py` (face grid, one column per
TAG dir). All configs below were dry-built and checked with `verify-workflow.mjs` against 8188. Set
TAG to an ABSOLUTE scratchpad path so PNGs stay out of git; wrap every run in
`gpu_lease.py run --timeout 3600`.

- [ ] 25 - **Phase A — does base + turbo match distilled?** MODES=expand, JOBS dark,cat,red,
  SEED 976866873943 / 42 / 1234 / 777777, 4 st / CFG 1 / lcm. Distilled = defaults; base + turbo =
  `UNET=flux-2-klein-9b.safetensors TURBO='Klein\klein_9B_Turbo_r128.safetensors' TURBO_STR=1.0`.
  24 runs, ~11 min (distilled ~20 s, base + turbo ~36 s). Sheet: `python faces.py <out>.png <distilledDir>
  <baseTurboDir>`. Fabio judges; never self-judge likeness.
- [ ] 26 - **Phase B — step x CFG sweep.** Base, SAMPLER=euler: STEPS 12/20/28 x CFG 3/4/5, dark photo,
  2 seeds = 18 runs, ~90 min (~15 s/step at CFG > 1; 20 st / CFG 5 measured 297 s). 1 seed halves it.
  **Confirm with Fabio at session start:** sweep base alone, or base + turbo (then TURBO_STR
  0.5/0.75/1.0 x STEPS 4/8 at CFG 1, ~36-70 s each).
- [ ] 27 - Decision and its shipping cost: base + turbo = new base-9B dep (size, VRAM on 16 GB, int8?)
  + turbo LoRA dep + R2, then re-export. The app graph today is DISTILLED (checklist 24).

## Bench

- [x] 1 - Klein 9B, no crop-stitch: first run about 20s, result "not too bad" (Fabio, 2026-09-13).
- [x] 2 - Klein 9B LoRA: `step3500_rank128`, at strength **0.75** — better than 1.0 (Fabio's export, 2026-09-13).
- [ ] 3 - Klein 4B: Fabio staged the undocumented `v1.1_optional` (rank 512), not the README's `v1`. No graph loads either yet.
- [x] 4 - Crop-stitch: KEPT in the exported graph.
- [ ] 5 - Side by side with the old Qwen Head Swap Flow — superseded by the decision in 6; skip unless Fabio wants it.
- [x] 6 - **DECIDED by Fabio 2026-09-13: Qwen is DROPPED, no tier; lcm sampler.** Graph exported to `comfy_workflows/raw/flow_head_swap.json` with `Output_Display`.

## App

- [x] 7 - R2: 9B + 4B BFS LoRAs uploaded, public `Content-Length` byte-exact; Qwen BFS LoRA DELETED from R2 (never shipped, Fabio's call).
- [x] 8 - Deps: `klein-9b-lora-headswap` added (sha256 = upstream `lfs.sha256`, upstream is the mirror); `qwen-lora-headswap` KEPT as DEPRECATED, `url` repointed at the upstream.
- [x] 9 - Graph: raw node 200 retitled `Input_Positive` -> `HeadSwap_Prompt` (the promptless-flow wipe); runtime regenerated via `workflow-to-api.mjs`, validators green.
- [x] 10 - FlowDef: `requiredModels ['klein-9b']`, `requiredDeps ['klein-9b-lora-headswap', 'comfyui-inpaint-cropandstitch']`, Speed radio removed; `flowHeadSwap` 1.1 in both registries.
- [x] 11 - Docs: `head-swap.md`, `UNRELEASED.md`, qwen-edit README; desktop spec fixture moved to `klein-9b`.
- [ ] 12 - Fabio's live run in his app (shared with MPI-747 `validation.md` § Live).
- [ ] 13 - Fabio retitles the bench node `HeadSwap_Prompt`, or the next export brings `Input_Positive` back.
- [ ] 14 - Tile + hero were cut from a Qwen run: re-cut via `/mpi-flow-graphics`, or keep — ask.

## Bench round 2 — the box comes back darker (2026-09-13)

- [x] 15 - MEASURED on bench runs #70-72 (`python research/seam_probe.py`, reads 8188 `/history`, diffs `Output_Image` against the source photo): outside `Input_Box` 0.00 change; just inside its top/left/right edges (background only) **-5 to -7 levels, uniform across RGB**. Klein returns the whole 360x360 box darker and the 32 px stitch blend only softens the edge. Bottom edge +28 R is the new hair/neck, content not defect.
- [x] 16 - `MpiInpaintHeal` after the stitch at `color 0 / grain 1 / ring 64 / feather 32` changed nothing measurable (grain is zero-mean, cannot move a tone shift). KJNodes `ColorMatch` REJECTED by Fabio: it is why `MpiInpaintHeal` was built. Neither route fixes it.
- [ ] 17 - Fabio's next approach, at the bench: Klein REMOVES the original person (a clean plate), then the new person, background removed, is composited onto that plate. Re-run `seam_probe.py` on it — the removal pass is a Klein crop too, so check the plate's box edges for the same shift wherever the cutout does not cover them. The wired graph and FlowDef will change again.
- [ ] 18 - The prompt's second paragraph, "Describe the expression in Picture 1 and copy it to the new image.", is a PLACEHOLDER (Fabio, 2026-09-13): it is meant to be REPLACED by a description of Picture 1's expression. The BFS author's Klein workflow carries a bypassed VLM ShowText branch that produced exactly that text; the README marks the line `[Optional]`. Today the literal sentence reaches the encoder. The Flow needs a describe step on `Input_Image` whose output replaces the paragraph (Vision already ships a VLM describe op, `imageDescribe`) — bench it first.

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
  **INVALID AS A BASE TEST (2026-09-13, sha256):** the bench's `C:\AI\diffusion_models\flux-2-klein-9b.safetensors`
  hashes `0975d6b7…` = BFL `FLUX.2-klein-9B` = the DISTILLED bf16. Base is `FLUX.2-klein-base-9B` /
  `flux-2-klein-base-9b.safetensors`, `4a54fad7…` — the SAME byte size (18157185168), so only the hash
  tells them apart. Every "base" run (this item, item 23's 20 st / CFG 5 297 s and the 2-up that
  reopened base vs distilled) ran distilled bf16; base + turbo = turbo stacked on an already-distilled
  model, overcooked on lcm, euler and euler_ancestral and WORSE at 8 steps than 4 (Phase B runs 1-3).
  **RAN 2026-09-13 (session d72a2c80), 24/24.** Distilled 22-24 s, base + turbo 34-40 s. Region composite
  bg |d|: distilled 0.05-0.07 on all three; base + turbo dark 0.07-0.16, red 0.07-0.10, **cat 0.62-0.99**
  (raw 2.6-3.1 vs distilled 0.6-1.0: base repaints more background and the change mask passes some).
  By eye, base + turbo 1.0 on lcm renders posterised, blotchy orange skin and a crunchy hair halo on
  EVERY seed and photo: a rendering defect, not a likeness call. Fabio's verdict pending. `faces.py` now
  takes `SRC`/`REF` = `path@x0,y0,x1,y1` columns (expression / likeness) and `ROWS=<job>`.
  **Base quants (checked 2026-09-13, HF API + safetensors header over a Range request):** BFL official
  `FLUX.2-klein-base-9b-fp8` 9.57 GB, gated (header unread); `rockerBOO/flux2-klein-base-9b-nvfp4-convrot`
  6.38 GB, `comfy_quant` (88 NVFP4 + 24 int8 convrot; comfy-kitchen has an eager NVFP4 path for Ada);
  `vistralis`/`milo01` int8 9.44 GB (same sha256) = ModelOpt layout, no `comfy_quant` -> NOT loadable
  on the bench's ComfyUI 0.34 (`comfy/utils.py` converts only legacy `scaled_fp8`). Licence: base and
  distilled are both FLUX Non-Commercial (Winnougan's `apache-2.0` tag is wrong).
- [ ] 28 - **NEXT SESSION, bench (Fabio 2026-09-13):** r3 (base bf16 + turbo 1.0 + head LoRA 0.75, 8 st,
  CFG 1, `SAMPLER=lcm SCHED=simple`) AND base alone with `LORA=0` (euler, 20 st, CFG 5) on `JOBS=cat` and
  `JOBS=red`, seed 42 (+ 976866873943 to match Phase A distilled), ONE run at a time, Read every face + full
  frame, then per-photo sheets (`faces.py` with `SRC=<photo>@<box>`: cat `215,100,575,460`, red
  `470,320,990,840`; `REF=...imported_002.webp@210,0,890,680`) against `phaseA_distilled` (session d72a2c80
  scratchpad is TEMP — re-run distilled if it is gone). Then wire the High tier per item 27, FOLDED INTO
  THIS CARD (Fabio: no new card).
- [ ] 26a - **Decided by Fabio 2026-09-13: Balance tier = distilled int8; HIGH tier = base 9B, with an
  optional Turbo toggle IF base + turbo renders clean.** Phase B = the turbo sweep, ONE run at a time,
  each face Read before the next. Real base needed first: no base weight on disk (MPI-600's was deleted).
  Ungated mirrors sha256-IDENTICAL to BFL: fp8 `a9f5028c…` 9567278472 B at `Amberamberamber/flux-2-klein-base-9b-fp8`
  and `wissxi/…` (header carries `_quantization_metadata` = native ComfyUI load); bf16 `4a54fad7…` at
  `unsloth/FLUX.2-klein-base-9B`, `SassyDiffusion/…`, `zhangchenxu/…`, `werobronsz/…`. MPI-600's
  `bertbobson/ComfyUI-INT8_ConvRot` base int8 now 401s. Starting points from a user report Fabio relayed:
  turbo ~0.5, 10-20 steps, CFG 2-2.5 (CFG > 1 = harness builds the empty-text negative). Distilled bf16 vs
  int8 at lcm/4/CFG 1 (dark s42): near-identical, bf16 slightly softer.
- [ ] 26b - **Phase B on the REAL base bf16** (`flux-2-klein-base-9b.safetensors`, sha256 MATCH `4a54fad7…`,
  from the `unsloth` mirror), dark s42, one run at a time, every face + full frame Read:
  r1 turbo 1.0 / 8 st / CFG 1 / euler: 66 s (incl. first 18 GB load), seam 0 — CLEAN, no blotches/halo.
  r2 turbo 0.5 / 8 st / CFG 3.5 / euler: 129 s, seam 0 — clean but smoother, painterly skin, fine
  texture lost vs r1. Sheet sent: `realbase_r1_dark_s42.png` (session d72a2c80 scratchpad).
  r3 turbo 1.0 / 8 st / CFG 1 / lcm + `simple` (SCHED): 64 s, seam 0 — clean; head tilt nearer the
  source, hair tucked behind the ear. 64 s = r1's 66 s, so NOT load time: base bf16 on the 16 GB card
  runs ~7-8 s/step (distilled int8 ~5 s/step), a High-tier cost to report.
  r4 turbo 1.0 / 8 st / CFG 1 / lcm + `beta57`: 62 s, seam 0 — clean, near-identical to r3 (both lcm
  schedulers converge; euler r1 gives a different composition, long loose hair).
  r5 turbo 0.5 / 8 st / CFG 3 / lcm + `beta57`: 124 s, seam 0 — clean; softer, lower-contrast film look,
  darker shorter hair. 5/5 real-base configs render clean; which keeps detail + likeness = Fabio's call.
  r6 base ALONE (no turbo) / euler / 20 st / CFG 5: 292 s, seam 0 — clean; natural soft skin, muted
  colour, head more upright than the source; composition close to r1, which is punchier. Turbo 1.0 at
  8 st = ~62 s = ~4.7x faster than base alone. Sheet with all six: `realbase_r1-r6_dark_s42.png` (sent).
  NOT run: 0.5 / 20 st / CFG 2.5 (costs base-alone time, so no toggle value); 0.25 / 8 st / CFG 3.5.
  **Next = Fabio picks which config(s) fan out to 3 photos x 2 seeds.**
  Fabio 2026-09-13, from `realbase_base_r3_r5_dark_s42.png`: base alone at the TEMPLATE's 20 st / CFG 5
  looks "very undercooked". Queued base alone euler / 30 st / CFG 5 to check; he then decides whether
  base ships with more steps and a lower CFG.
  **High tier target (Fabio 2026-09-13): production work, expect an RTX 5090 + ~90 GB system RAM. Time is
  NOT a criterion — pick on quality.** Base bf16 (18 GB) fits a 32 GB card whole, so this 16 GB bench's
  ~7-8 s/step (offload) is not representative of that user's speed.
  base alone euler / 30 st / CFG 5: 434 s, seam 0 — clean, near-IDENTICAL to 20 st (same pose, soft skin,
  muted colour): converged by 20, so steps at CFG 5 are not the lever. 40 st / CFG 4 queued right after
  at Fabio's call (cancel if 30 satisfies him). Sheet: `realbase_base20_base30_r3_r5_dark_s42.png`.
  **Was the BFS head LoRA trained on base? (Fabio's hunch, 2026-09-13)** Metadata: ai-toolkit 0.7.20,
  `ss_base_model_version = flux2_klein_9b`, no checkpoint path. ai-toolkit's `flux2_klein_9b` arch is
  labelled "FLUX.2-klein-base-9B" with default `name_or_path` = `black-forest-labs/FLUX.2-klein-base-9B`
  -> TRAINED on base by default (INFERRED, the path is overridable). The author's own workflow
  `workflows/Head Swap V1 Flux 2 Klein 4b_9b (base_distill).json` RUNS it on `flux-2-klein-9b.safetensors`
  (= DISTILLED) / Flux2Scheduler 4 st / CFG 1 / lcm / LoRA 1.0 — our Balance config. So it is tuned
  and shown on distilled. A/B queued: base alone 20 st / CFG 5 with the head LoRA OFF (`LORA=0`) vs r6.
  **Fabio 2026-09-13: best = distilled and r3; r3 better on light AND likeness** (face crops only). Full-frame
  + 2x head sheet `light_distilled_vs_r3_dark_s42.png` sent. Agent's second opinion (one seed, not a
  verdict): r3 carries the source's warm side key light + falloff and its head tilt; distilled is lit
  flatter/frontal. Distilled's rounder face and ash-blonde waves sit nearer the reference; r3 goes slimmer
  and copper-toned. Next if Fabio agrees: r3 on 3 photos x 2 seeds against Phase A's distilled.
  base alone euler / 40 st / CFG 4: 561 s, seam 0 — clean and near-IDENTICAL to 20 st / CFG 5 and 30 st /
  CFG 5. Base alone converges to one soft, muted image; steps and CFG 4-5 are not the lever. Sheet:
  `base_steps_vs_distilled_r3_dark_s42.png`. The LoRA-off A/B (20 st / CFG 5) started right after.
- [ ] 26 - **Phase B — step x CFG sweep.** Base, SAMPLER=euler: STEPS 12/20/28 x CFG 3/4/5, dark photo,
  2 seeds = 18 runs, ~90 min (~15 s/step at CFG > 1; 20 st / CFG 5 measured 297 s). 1 seed halves it.
  **Confirm with Fabio at session start:** sweep base alone, or base + turbo (then TURBO_STR
  0.5/0.75/1.0 x STEPS 4/8 at CFG 1, ~36-70 s each).
- [x] 27 - **DECIDED by Fabio 2026-09-13** (after base alone 20/30/40 st and the LoRA-off A/B: 276 s, same
  soft look WITH or WITHOUT the head LoRA, so the softness is base + euler, not the LoRA; without it the
  face drifts further from the reference). Test photo caveat (Fabio): the dark source is heavily edited,
  painted shadows and a fake background, so no config "relights" it right; r3 is the best so far.
  - **Balance tier** = distilled 9B int8 (shipping today).
  - **High tier** = base 9B bf16 (`flux-2-klein-base-9b.safetensors`, 18157185168 B, sha256 `4a54fad7…`).
    MODEL defaults (prompt box) = 20 st / CFG 5, with a **Turbo button** on the prompt box.
  - **Flows on High tier = turbo ALWAYS ON with r3's settings**: `klein_9B_Turbo_r128` 1.0, 8 st, CFG 1,
    `lcm` sampler + `simple` scheduler (BasicScheduler, not Flux2Scheduler), head LoRA 0.75.
  - Shipping cost: base bf16 18.16 GB + turbo LoRA 1.39 GB = two new deps + R2; target user = RTX 5090.
  - Reverses `docs/models/klein/9b.md` § REJECTED (MPI-600 turbo) FOR THE HIGH TIER — rewrite that section
    when wiring, keep the MPI-600 evidence. Not yet run: r3 on cat/red + a second seed.
  - **Fabio 2026-09-13, from `base_lora_on_off_dark_s42.png`: base works BETTER with the head LoRA OFF.**
    (The agent read the LoRA-off face as further from the reference; likeness is Fabio's call.) Open for the
    Flows: does High-tier turbo (r3) also do better without the head LoRA? r3 + `LORA=0` run queued.
    **r3 + head LoRA OFF: 60 s, seam 0, clean render, but the swap mostly did not happen** — it kept
    the SOURCE's wet stringy auburn hair, red lipstick and makeup instead of the reference's hair and look.
    With turbo the head LoRA carries the swap. Sheet: `lora_on_off_r3_and_base_dark_s42.png`.

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

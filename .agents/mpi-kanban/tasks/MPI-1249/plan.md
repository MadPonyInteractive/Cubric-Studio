# MPI-1249 plan — MOSS-Image style LoRAs

Steps: brief.md § To do (1-6). Pattern: `docs/playbooks/add-model/05-prompt-and-styles.md` §9 (Krea2).

## Verification

**Verify mode:** user-ux (Fabio judges the style renders and the Styles-panel images).

## Current State

2026-10-22 (Moss image 7), handoff before any code:
- Four Apache-2.0 LoRAs downloaded to `M:/CubricModels/loras/moss/` (pixel art re-keyed, see brief).
- Fabio wired the style nodes in `comfy_workflows/raw/moss_t2i_template.json` (uncommitted, his save).
- NEXT: read the raw, regenerate, then deps (R2 = ask the price), ModelDef styles; Fabio makes the preview images.

2026-10-22 (Moss image 8):
- Raw had slots 3/4 swapped vs trigger lines 3/4: slots fixed (Anime, Gouache, Psychedelic, Pixel Art). Committed 54267294b (+ generate_moss.py now runs the Krea2 `_assert_style_rack`).
- Trigger concat (node 88) delimiter was "" -> fused "...promptmoss_vgouache_style". Set to ", " in the raw, re-synced (staged, uncommitted). Trigger still at the END; authors want START for gouache/psychedelic = Fabio to judge in his test (swap concat inputs in ComfyUI if needed).
- Deps `moss-style-{anime,gouache,psychedelic,pixelart}` in loraDeps.js (sha256 of M: files; axiomofmind mirrors = HF lfs.oid; pixel art noMirror). ModelDef: styleLoras true, labels, styleOps (all 5 ops), deps. NO styleLoraImages (test requires files on disk).
- Lint + npm test green (3518/0). Enhancer: triggers are appended in-graph, never in the box, so the recipe cannot strip them.
- NEXT: Fabio tests the styles in his app (Fabio: wire first, R2 yes only after his test). Then R2 upload (~372 MB, ask price), preview images, guide + README.

- Anime "does nothing" (t2i_041) = the ENHANCER, not the LoRA: sidecar selector 1 + log `168 patches attached` (SFT fuses q/k/v into proj.qkv, so 42x4 patches; Turbo 42x6=252), but the enhanced prompt opened "A dramatic color photograph", because the recipe makes a medium-less prompt a photograph and enhance() never hears the picked style. Proposed fix: a style rule appended to the system prompt like TRANSPARENT_BACKGROUND_RULE (registry.js), fed from the prompt box (MpiEnhanceDialog -> enhanceLocally -> enhance) and settleInGraphEnhance; all style models. Fabio said yes; SHIPPED 893c547df (styleRule in registry.js; enhance({style}); dialog + prompt box pass the label, stale-style note; settleInGraphEnhance reads Input_Style_Selector.selector). NOT covered: the generation-time toggle on the ComfyUI backend (Krea2/Klein in-graph TextGenerate uses its baked prompt, never a recipe). NEXT: Fabio re-tests Enhance with Anime on; then R2 yes, preview images (re-claim display/, tell LTX 2.5 model 4), guide + README.
- Commits: a9215105b (deps + ModelDef + delimiter, pushed; fixed red master after a peer push published 54267294b alone).
- SFT SETTINGS QUESTION (Fabio, end of Moss image 8): our SFT = Comfy-Org template (25 steps, cfg 2.5, er_sde/simple, no SLG; the template turns SkipLayerGuidanceDiTSimple ON for Base only; no Spectrum node in it). OpenMOSS's own card (MOSS-Image-SFT README, "Sampling settings"): Euler, 50 steps, CFG 3, shift 5, negative-branch layer skip at layer 22, empty negative. So 25 is NOT from the Spectrum node, but it is half the authors' steps. SFT showed doubled legs and scrambled buildings (Anime/Gouache/Psychedelic). NEXT: A/B SFT ours vs OpenMOSS (50 / cfg 3 / euler + SLG layer 22) on the superhero + skydiving prompts, with and without a style; Fabio judges. ~2x SFT time.
- Spectrum node (`Rkkss/ComfyUI-Spectrum-MOSS`, GPL-3.0, SFT speed-up 2-2.5x): never tried; A/B it only if 50-step SFT wins (it would win the time back).
- "Boxes from picture" (video 3g-dbIEa3II): Fabio REJECTED (MOSS cannot see pixels, it only confuses users). Do not build.
- Style tests: Anime, Gouache, Psychedelic Pop verified in style on Turbo + SFT; Turbo better (Fabio). Pixel Art untested. Then R2 yes (~372 MB), preview images (re-claim display/ after telling LTX 2.5 model 4), guide + README (Turbo recommended with styles; pixel art 512 + magenta).
- Fabio: no sub-sessions from this card (context); hand off instead.
- Fabio's read of SFT (his tests): it adds more elements but never cooks them properly and leaves a mess. The YouTuber runs CFG 3 at 25 steps WITH the MOSS (Spectrum) node. So the A/B should include 25 / cfg 3 + Spectrum, not only 50 / cfg 3.
- PREVIEWS: Fabio makes all style preview images on TURBO (they show small; only to give users an idea). Agent crops to 4:5 WebP 512x640 as `moss-style-{none,anime,gouache,psychedelic,pixelart}.webp` in `comfy_workflows/display/`, then adds `styleLoraImages` to the MOSS ModelDef (the style-rack test requires every listed file on disk).

## Completed

## Remaining Work

brief.md § To do 1-6.

## Plan Drift

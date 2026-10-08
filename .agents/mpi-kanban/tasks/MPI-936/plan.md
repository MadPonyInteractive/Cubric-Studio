# MPI-936 Plan - Qwen-Image 2.1, Klein's seven ops

## Current State

2026-10-08 (session 6271e0b6). All seven ops proven on the bench (`research/bench-results.md` runs 2-3).
Raw exported + committed by the sync (541caee9a); runtime `comfy_workflows/qwen_image_2_1.json` converted,
validated and STAGED (uncommitted). ModelDef, ControlNet dep, rank, guide, doc hub written (uncommitted).
Preview: Fabio picked A (Lisbon tram) -> `comfy_workflows/display/qwen-image-2-1.webp`. MPI-1045's message
(8a39bdab) answered: assetDeps.js released to them, their two models.js comment lines made here.
Next: the in-app run per op in an isolated app (`npm run app:isolated`), RGBA through capture, NC flag eye-test.
Gotchas found: MpiAnySwitch10 = Nth CONNECTED input (wire every slot); the converter needed autogrow
`min: 0` support (fixed); the upscale crosshatch is 4x-NMKD-Siax's (app-wide, Noticed).

## Plan Drift

- 2026-10-08: scope was t2i + edit (one bare graph, no opInject). Fabio: "the Klein one is the most appropriate
  one ... all the operations an image generator/editor should have", "including inpainting". Now seven ops,
  numbered as Klein's so `opInject` reads the same: 1 t2i, 2 i2i, 3 control, 4 edit, 5 inpaint, 6 detail,
  7 upscale. Still ONE bare raw `qwen_image_2_1.json` (one size, so no generator), now WITH opInject.
- Run 1's "edit loses alpha" was a harness bug (run.py saved the loader preview). Void.

## Ops (graph.py)

| wf | op | branch | proof |
|---|---|---|---|
| 1 | t2i | Empty Latent, text-only encode | run 1 |
| 2 | i2i | Input_Image resized to W x H (/32) -> VAEEncode -> KSampler at Input_denoise, text-only encode | bench |
| 3 | control | depth (DepthAnythingV2) / pose map -> `QwenImageDiffsynthControlnet` with the 2.1 **Fun ControlNet Union** (`model_patches/qwen_image_2.1_fun_controlnet_union_int8_convrot`, 3.78 GB, research licence, HF-only) at Input_Control_strength; Empty Latent sized on the input | **needs Fabio's OK to download** |
| 4 | edit | current: refs through TextEncodeQwenImage21, encoder latent | run 2 |
| 5 | inpaint | mask crop -> VAEEncode crop -> SetLatentNoiseMask -> **LanPaint_KSampler** (Klein's route) -> decode -> SplitImageWithAlpha -> stitch. Masked `edit` takes the same path, as on Klein | bench. Fallback: the ControlNet's own inpaint mode (`mask` input) |
| 6 | detail | mask crop upscaled to 1024 -> VAEEncode -> KSampler at Input_denoise -> split alpha -> stitch (our crop/stitch, not Impact's MaskDetailer: its paste would meet the RGBA decode) | bench |
| 7 | upscale | UltimateSDUpscale (4x-NMKD-Siax, Input_Upscale_Factor, Grid via MpiGridDimensions) at Input_denoise | bench: does USDU accept an RGBA tile decode? |

Shared: user LoRA rack Input_Lora_1..6 (as Klein/Boogu). NO style rack (no 2.1 style LoRAs exist), NO prompt
enhancer, NO NSFW LoRA. Every non-t2i/edit branch outputs RGB (split alpha): it repaints an opaque source.

LanPaint on 2.1: model is `ModelType.FLUX` (Klein's path in LanPaint), and `QwenImage21Cache` only caches the
constant text/ref prefix, so LanPaint's repeated calls per step are safe. Prove on the bench anyway.

## Remaining Work

1. ~~graph.py seven ops, bench~~ done. 2. ~~control~~ done (download approved). 3. ~~export + convert~~ done
   (sync failed on the converter's autogrow check after committing the raw; fixed the converter and ran the
   sync's convert + validate + stage steps by hand for this one file). 4. ~~ModelDef, deps, progressStages
   (no entry)~~ done. 5. ~~rank, guide~~ done.
6. Preview webp: Fabio picks a candidate (`scratchpad/out/preview_{a,b}.png` of session 6271e0b6).
7. In-app run per op in an isolated app (`npm run app:isolated`), RGBA through capture; NC flag eye-test.
8. Agent read-back + three agent tests. Re-run `npm test` once MPI-1045's in-flight test lands.

## Completed

- Groundwork commit 4a8b065b3 (licence gate, HF-only deps, encoder reuse, NC tile flag).
- Bench run 2: masked-edit stitch fixed (SplitImageWithAlpha), run.py harness fixed, 2K t2i 60 s.

## Verification

**Verify mode:** user-ux (NC tile flag eye-test, in-app op runs)

# MPI-1095 research - LTX 2.5 (2026-10-22)

Scope (Fabio 2026-10-22): two stages, like FLUX.3. **Stage 1** = the 2.5 MODEL alone (t2v / i2v /
ref2v + audio), dev-gated with `devOnly: true` until ready, quick release. **Stage 2**, after that
release = 2.5 in the LTX Flows + the new 2.5-only Flows (tiled upscaler etc., MPI-578).

"Verified" = checked this session by reading code on the G: bench or the HF API. Everything
else came from three research sweeps and carries its source; treat as unverified until benched.

## 1. Engine - VERIFIED: 2.5 loads on the shipped engine

- Shipped pin is **ComfyUI v0.42.1** (`dev_configs/node_lock.json`, commit `63be2f9b`), not v0.39.0 as
  this card first said. The G: bench runs the same v0.42.1.
- Core commit `57ce8e1a` "Add support for LTX 2.5 (#15499)" (2026-08-11) IS an ancestor of the
  bench HEAD. It adds Gemma 4 text encoder support, the duration head, and the diffusion VAE decoder
  (`comfy/sd.py:630`, detected by `decoder.conv_in_x_t.weight`, loads through plain `VAELoader`).
- **Our ComfyUI-LTXVideo pin `3b9c5cde` (2026-07-27) predates 2.5.** Latest upstream is v1.1.0
  (`220e1d45`, 2026-10-20). Our 2.3 graph uses four nodes from that pack:
  | Node | Upstream change since our pin |
  |---|---|
  | `LTXVNormalizingSampler` (easy_samplers.py) | refactor only (`63a7f34e`, guide call renamed) |
  | `LTXAddVideoICLoRAGuide` / `LTXICLoRALoaderModelOnly` (iclora.py) | `frame_idx = -1` = single-image reference outside the clip (relevant to Ingredients); `use_streaming` for tiled fusion |
  | `LTXVSpatioTemporalTiledVAEDecode` (tiled_vae_decode.py) | none - **untested with the diffusion VAE** |
  Stage-1 test question: does our graph run on 2.5 with the current pin? If not, bump the pin
  (node_lock edit, ships via `/mpi-bump-engine` smoke). Tiled fusion + HDR need v1.1.0 (stage 2).
- Everything else in the graph is core (`comfy_extras/nodes_lt.py`) or KJNodes (`LTX2_NAG`,
  `LTXVImgToVideoInplaceKJ`, `VAELoaderKJ`, `ImageResizeKJv2`).

## 2. Weights - VERIFIED (HF API, `Lightricks/LTX-2.5`, gated: auto)

| File | Bytes | 2.3 equivalent we ship |
|---|---|---|
| `diffusion_models/ltx-2.5-22b-distilled-transformer-bf16` | 42,018,190,584 | distilled-1.1 bf16, 42,020,150,120 |
| `diffusion_models/ltx-2.5-22b-distilled-transformer-comfy-int8-convrot` | 21,504,034,224 | int8_convrot, 21,505,993,424 |
| `diffusion_models/ltx-2.5-22b-distilled-transformer-nvfp4` | 18,721,548,408 | - (Blackwell-native) |
| `diffusion_models/ltx-2.5-22b-dev-transformer-{bf16,comfy-int8-convrot}` | 42.0 / 21.5 GB | - |
| `text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16` | 26,263,858,182 | Gemma 3 fp4_mixed 9,447,702,218 + separate text projection |
| `text_encoders/gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot` | 15,372,969,374 | (same) |
| `vae/ltx-2.5-video-vae-bf16` (diffusion VAE, "DFR") | 1,472,223,346 | LTX23 video VAE |
| `vae/ltx-2.5-video-vae-conv-bf16` (conv, faster) | 1,452,269,922 | LTX23 video VAE |
| `vae/ltx-2.5-audio-vae-bf16` | 364,866,540 | LTX23 audio VAE (near-identical size) |
| `latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0` | 995,778,752 | 2.3 spatial x2 |
| `latent_upscale_models/ltx-2.5-latent-temporal-upscaler-x2-bf16-1.0` | 261,944,000 | - |
| `loras/ltx-2.5-22b-distilled-lora-450-bf16` | 8,899,889,568 | (dev + LoRA route only) |
| `model_patches/ltx-2.5-duration-head-bf16` | 3,843,690 | - (auto clip length) |

- Transformer sizes match 2.3 byte-for-byte within rounding: the two cards map 1:1 (balanced = bf16,
  fast = int8 convrot). No Kijai 2.5 repo and no Comfy-Org 2.5 split repo exist (checked).
- **Text encoder is the cost.** Gemma 4 12B (Lightricks fine-tune, projection bundled) replaces
  Gemma 3. Smallest official file is int8 at 15.4 GB vs our 9.4 GB Gemma 3 fp4. Community GGUF
  (`elix3r/gemma4-12b-with-proj-ltx-2.5-GGUF`, Q4_K_M ~8.4 GB, unverified) would need ComfyUI-GGUF
  (already in node_lock). Stage-1 decision: which encoder file on which card.
- No TAEHV preview decoder for 2.5 found yet - check whether `taeltx2_3` still previews 2.5 latents.
- Licence: `ltx-2.x-community-license-agreement`, the SAME licence as 2.3 (one 2.x licence; free
  under USD 10M revenue). Gated repos, so our R2 re-host + sha256-vs-`lfs.sha256` proof applies as for 2.3.

## 3. Op parity (stage 1)

| 2.3 op | 2.5 | Note |
|---|---|---|
| `t2v_ms` + synced audio | yes, native | same LTXAV dual-stream class |
| `i2v_ms` start / end / both | yes | 2.5 adds a learned keyframe position embedding (multi-keyframe) |
| `ref2v_ms` (Ingredients) | yes, new 2.5 build | see LoRA table |
| reference voice / direct audio | to test | core `LTXVReferenceAudio` exists; our voice-ID path is the TalkVid LoRA (below) |
| six user LoRA slots | to test | Lightricks: "most 2.3 LoRAs and IC-LoRAs run on 2.5 unchanged; a few do not" |

New on 2.5 with no 2.3 twin: native multi-shot prompts, duration predictor, temporal x2 upscaler,
diffusion VAE, HDR output, 4K/8K tiled fusion (custom-node v1.1.0).

## 4. LoRA parity - our five baked 2.3 LoRAs

| Baked LoRA (2.3) | Source | 2.5 build | Verdict |
|---|---|---|---|
| `ltx23-lora-merged` | ours: Soft Enhance (vrgamedevgirl84) + Abliterated (Lightricks Gemma-3 LoRA) + Detailer | none | **VERIFIED partial break**: our file holds 672 `text_encoders.gemma3_12b.*` keys (the abliteration) + transformer keys. The text half has nothing to attach to on Gemma 4. No Gemma-4 abliteration found. Transformer half (soft + detail) may load - test. |
| `ltx23-lora-transition` | joyfox / valiantcat, Apache-2.0 | none | test the 2.3 file on 2.5 |
| `ltx23-lora-talkvid` | AviadDahan ID-LoRA (ECCV 2026), native core node since PR #13111 | none | test; voice-ID on 2.5 unproven |
| `ltx23-lora-foley` | Lightricks, gated | none | Lightricks docs: "LTX-2.5 support is in development" - Foley Flow stays on 2.3 (stage 2 anyway) |
| `ltx23-lora-ingredients` | Lightricks, gated | **YES** `Lightricks/LTX-2.5-22b-IC-LoRA-Ingredients` (2026-09-10), `ltx-2.5-22b-ic-lora-ingredients-0.9.safetensors` 1,308,787,472 B | VERIFIED a different file from our 2.3 one (1,308,778,338 B). Loader re-point, as MPI-1060 planned. |

Consequence for "replace or beside": on 2.5 the abliteration is lost (no Gemma-4 equivalent), Foley
is unvalidated, voice-ID untested. Until those are answered 2.5 cannot REPLACE 2.3 at parity;
stage 1 lands it BESIDE 2.3, dev-gated. Final call stays Fabio's.

## 5. Stage-2 menu - every official 2.5 LoRA (all `Lightricks/LTX-2.5-22b-*`, gated, created 2026-08 to 09)

| Repo | Unlocks | Shape |
|---|---|---|
| IC-LoRA-Pixel-Spatial-Upscaler | generative 2x upscale; stage 2 of DFR | Flow (upscale) |
| IC-LoRA-Refine-Details | tiled 4K/8K detail refine | Flow (MPI-578 Route B) |
| IC-LoRA-Restore | archive restoration (+ Refine at 2x) | Flow |
| IC-LoRA-Decompression | compression-artefact removal | single pass |
| IC-LoRA-Deblur | defocus deblur | single pass |
| IC-LoRA-Colorization | B&W to colour | single pass |
| IC-LoRA-Day-To-Night | relighting | single pass |
| IC-LoRA-Clean-Plate | remove moving people / subjects, no mask | single pass |
| IC-LoRA-Alpha-Gen | alpha matte (hair, smoke, glass) | single pass, heavy VRAM |
| IC-LoRA-Water-Simulation | "ADD WATER" VFX | single pass |
| IC-LoRA-SDR-To-HDR | HDR master (EXR / HLG) | single pass, custom-node v1.1.0 |
| IC-LoRA-Layout-To-Render | 3D clay playblast + first frame to finished shot | Flow |
| IC-LoRA-Ingredients | reference to video | stage 1 (op) |
| LoRA-Cinemagraph | selective-loop i2v (`CINEMAGRAPH_MOTION`) | op or Flow |
| LoRA-Slow-Motion-Control | speed control, 5x to 40x slow | op param |

2.3 adapters Lightricks name as reused on 2.5: Motion-Track-Control (official 2.5 guide uses the 2.3
file). Still 2.3-only, 2.5 unconfirmed: Union Control (pose / depth / canny), DubIt / LipDub, Relight,
In-Outpainting (a 2.5 example workflow exists), HDR (old), Cross-Eyed, Instant Shave.
Community: BFS head swap has 2.5 builds (r64 / r128, `Alissonerdx/BFS-Best-Face-Swap-Video`) for
MPI-745. No local camera LoRAs for 22B (camera presets are API-only).
Official 2.5 example workflows live in ComfyUI-LTXVideo `example_workflows/2.5/` (absent at our pin).

## Corrections to the sweeps (do not re-import)

- 2.3 already had native joint audio and a spatial x2 upscaler: "native audio is new in 2.5" and
  "latent upscalers are new in 2.5" are wrong.
- One sweep reported no 2.5 Ingredients build; the HF API shows one (above).

## Next (stage 1)

1. Fabio: accept the gated licence on HF for `Lightricks/LTX-2.5` + `-IC-LoRA-Ingredients` (one account).
2. Bench on G: - re-point `ltx_i2v_t2v_template.json` loaders (transformer, Gemma 4 encoder, conv vs
   diffusion VAE, audio VAE, upscaler, Ingredients), keep the 2.3 graph shape, run t2v / i2v / ref2v /
   voice side by side with 2.3 (same prompts, seeds).
3. Per baked LoRA: run the 2.3 file on 2.5, by eye; drop or keep.
4. Then `/mpi-add-model` with `devOnly: true`.

## Bench setup (2026-10-22, session "LTX 2.5 model 2")

- HF token: `C:/Users/Fabio/.secrets/hf.txt` (Mad-Pony-Interactive) reads both gated repos (200); the ambient `~/.cache/huggingface/token` (MadPonyInteractive) gets 403.
- Downloader: `research/bench/dl.py` (hf_hub_download, resumes from `.incomplete`). DONE: duration head, 2.5 audio VAE, both 2.5 video VAEs, 2.5 + 2.3 spatial upscalers (in `G:/ComfyUi/ComfyUI/models/{model_patches,latent_upscale_models}`, G:/models has no mapping for those), 2.5 Ingredients (`G:/models/loras/ltx-2.5/`). PAUSED at Fabio's request (his app downloads): Gemma 4 int8 (4.5/15.4 GB), 2.5 int8 transformer, 2.3 int8 transformer (Kijai/LTX2.3_comfy; no 2.3 transformer left on any local drive).
- Bench driver: `research/bench/ltx25_bench.py` (shipped int8 runtime graph, 6 loaders re-pointed, Gemma 4 via CLIPLoader since the projection is bundled; 8 cases x variants 23/25/25d/25bare; `--check` passes). Run under `gpu_lease.py run --poll 2`.

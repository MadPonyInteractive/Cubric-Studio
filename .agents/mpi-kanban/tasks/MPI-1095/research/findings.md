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
- 2026-10-22 ("LTX 2.5 model 3"): 2.3 int8 transformer dropped from `dl.py`. Fabio's app installs the same file (`ltx23-transformer-int8`) into `M:/CubricModels/diffusion_models/`, which the bench already maps (`cubric_models` in `G:/ComfyUi/ComfyUI/extra_model_paths.yaml`, incl. `latent_upscale_models` + `model_patches`). An app download is in flight while `<file>.cubricdl` exists. `dl.py` needs user site-packages: run it WITHOUT `-I`.
- 2026-10-22 07:55: **2.5 RUNS on the ComfyUI-LTXVideo pin** (`3b9c5cde`, bench ComfyUI 0.42.1). `25:t2v` success, 240 s wall incl. first load, 960x512 24 fps 5 s + audio track (mean -42.6 dB, waves). Frames 0/60/119 coherent: fisherman, pier, gulls, slow push-in. Only node change: DualCLIPLoader -> CLIPLoader (Gemma 4 + bundled projection).
- 2026-10-22 overnight: done `t2v` 23/25, `t2v_talk` 23/25 (201 s / 215 s), `i2v_start_23` (216 s); sbs webms in `C:/AI/MPI-1095-out/`. The box BLUESCREENED at ~08:59:40 (bugcheck 0x50 PAGE_FAULT_IN_NONPAGED_AREA, dump `C:/Windows/Minidump/102226-45984-01.dmp`, admin-only) during `i2v_start_25`'s stage-2 sampling, inside OUR lease, ComfyUI serial on :8188, Ollama idle since 10-21. No Resource-Exhaustion (2004) or TDR (4101) event before it, so not a Windows-detected OOM; the WHEA id 3 after reboot is the routine PCIe record (9 in 30 days). Previous bugcheck on this box: 0x119 (GPU scheduler) 2026-10-04. Cause unproven.
- On 2.5 the merged 2.3 LoRA's TEXT-ENCODER half fails to apply (`ERROR lora gemma3_12b...shape invalid`, harmless skips): its clip weights are Gemma 3 shaped. Only its transformer half can matter on 2.5.
- 2026-10-22 midday, Fabio: **no 2.3 LoRAs on the 2.5 workflow.** `ltx25_bench.py` now wires around Transition, talk3_ID and Merged on every 2.5 variant (`--check` asserts no `ltx-2.3` string left; `25bare` dropped as redundant). The two 2.5 clips made WITH them are kept as `*_25lora23.mp4`. Fabio found the GPU driver out of date (likely cause of the 0x50 and the 10-04 0x119); updating before the bench resumes.
- 2.5 replacements for the three on HF (2026-10-22): **none official.** Lightricks ships Ingredients (in use), Refine-Details (an IC-LoRA, not a drop-in detailer), Cinemagraph, Slow-Motion-Control and a row of IC-LoRAs (Restore, Deblur, Day-To-Night, ...); no transition and no talking-head ID LoRA. Third-party candidates only: CQdesign enhancer LoRAs (detailer slot), Gemma 4 "heretic" encoders (abliteration slot).
- **Speed, 4060 Ti 16 GB, driver 621.01, 960x512 5 s, int8 both** (comfyui.log 12:31-12:47): stage 1 (7 steps) 2.5 = 2.7-2.9 s/it vs 2.3 = 5.2-5.9 s/it (~2x); stage 2 (3 upscaled steps) 2.5 = 8.7 s/it vs 2.3 = 11.0-11.4 s/it (~25%). Whole prompt, model already loaded: 2.5 87-110 s vs 2.3 146-166 s (~35-40% less). Caveat: 2.3 runs WITH its shipped LoRAs, 2.5 with none (2.5 + the 2.3 LoRAs the night before: 215-240 s, so part of the gap is the LoRAs). A 2.5 run straight after a 2.3 run can be as slow as 2.3 (i2v_end_25, 158 s) while both 22B transformers fight for RAM; the app never holds both.
- 2026-10-22 13:04: **all 8 cases done on 23 and 25 (2.5 with NO 2.3 LoRAs), no crash on driver 621.01.** sbs webms `C:/AI/MPI-1095-out/<case>_23_vs_25.webm` sent to Fabio for his eye. My frame read (one seed, not a verdict): every clip renders clean; `t2v_25` ignored "medium shot" (wide pier, fisherman a small silhouette from ~frame 80; WITH the 2.3 LoRAs it was medium); `ref2v_25` opens on her back and turns to face camera ~frame 80, so identity shows only late. 2.5 wall times, model warm: ref2v 170, voice_ref 130, audio_in 130 s vs 2.3 200 / 221 / 201 s.
- **VERDICT, Fabio 2026-10-22: 2.5 wins.** Acting is "way, way superior": actors' motion and expressions far more natural. Picture quality: not much better than 2.3 on these clips. Decision basis = acting (+ ~35-40% speed). 2.3 LoRAs stay OFF on 2.5.
- Abliteration slot on 2.5 = an abliterated TEXT ENCODER, not a LoRA. Candidate: `DeepNeuralNerd/Gemma-4-12B-it-uncensored-heretic-DeepNeuralNerd-LTX_2.5_ComfyUI` (base `llmfan46/gemma-4-12B-it-uncensored-heretic`, LTX projections remapped in), int8convrot 13.17 GB (SMALLER than the official 15.37 GB int8) + bf16 26.26 GB; licence "other" = upstream Gemma 4 + LTX terms (check before shipping). Author's own scope: prompt fidelity / fewer silent refusals, not uncensored video. Bench variant `25h`, all 8 cases, queued 2026-10-22 13:2x.
- Bench driver: `research/bench/ltx25_bench.py` (shipped int8 runtime graph, 6 loaders re-pointed, Gemma 4 via CLIPLoader since the projection is bundled; 8 cases x variants 23/25/25d/25bare; `--check` passes). Run under `gpu_lease.py run --poll 2`.

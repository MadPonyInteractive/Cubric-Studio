# ATAS driving MiniMax-H3 — scope, blockers, estimate (research only)

Date 2026-10-18. Nothing was run, nothing was spent. Sources: ATAS repo at `b86aab0` (cloned to a scratch dir, read-only), arXiv 2610.20571 HTML, lhmd.top/atas, our `docs/models/h3/*`, `commandRegistry.js`, DeepInfra's keyless price API, runpod.io/pricing.

## Recommendation (plain)

**Do not build the adapter now.** Build nothing until one cheap spike answers the only question that matters: *does H3 reference-to-video obey a rendered point-cloud video as a camera/geometry guide?* ATAS's gain comes from that conditioning, and the paper, the project page and the released code are all silent on how H3 was fed. If the spike passes, the adapter itself is small (about 300 lines). The dependencies around it are the real cost (below), and the Pi3X weights are non-commercial.

For Cubric's actual goal (same place across shots), a much cheaper route exists and is already on the board: MPI-1039 Multi-angle Flow (image edit of one locale into N views, fed to H3 r2v as `<Picture n>`). ATAS adds *exact camera + validated memory* on top of that; it is a second-phase upgrade, not a first step.

## 1. What the paper says about H3

- H3 is one of four backbones in Tab. 1, listed under "Open-Source Models" (the others: Wan 2.7, HappyHorse 1.0, Wan 3.0). Each block shares "the generator, prompt package, duration budget, and aggregation protocol" across methods.
- **What H3 was fed is not stated anywhere I could read** (paper HTML, project page): not prompt-only vs stills vs rendered point cloud, not API vs local weights, not shot count, not resolution. The method section only says scene memory "supplies static point-cloud references" and `V_t = G(q_t, C_t)`.
- The **released code has no H3 adapter** — only a Wan 2.7 / Wan 3.0 DashScope client. The H3 and HappyHorse numbers cannot be reproduced from the repo.
- Improvement, Tab. 1 Avg. column (ATAS vs the strongest baseline, ReCA):

| Backbone | I2V Ext. | ReCA | ATAS | ATAS − ReCA |
|---|---|---|---|---|
| MiniMax-H3 | 0.605 | 0.659 | **0.702** | +0.043 |
| Wan 2.7 | 0.531 | 0.612 | 0.656 | +0.044 |
| HappyHorse 1.0 | 0.599 | 0.656 | 0.694 | +0.038 |
| Wan 3.0 | 0.592 | 0.648 | **0.734** | **+0.086** |

  H3 per metric (ReCA → ATAS): VBench 0.844 → 0.860, ST-Bench 0.628 → 0.691, ViStory-Self 0.658 → 0.710, **ViStory-Cross 0.508 → 0.547**. So H3 gains about half what Wan 3.0 gains, and H3 + ATAS (0.702) still sits below Wan 3.0 + ATAS (0.734). Cross-shot consistency (the thing we want) moves +0.039 on H3 vs +0.103 on Wan 3.0. Gains over the plain "I2V Extension" baseline are larger (+0.097 avg on H3), but that baseline is the weakest.
- Efficiency table (backbone not named, likely Wan via API): 51.9 → 64.9 min per story, 7.28 → 6.21 shots/h (so about 6-7 shots per story), memory overhead about 98 s per shot, retries 1.00 → 0.54 per shot.

## 2. Provider interface → what H3 can accept

ATAS's provider code is `Wan27Client` (the "wan" folder); `router.py` only picks a DashScope lane (`wan3.0-video-prime` / `wan3.0-video`) and a 429 cooldown, then calls the same client. The wire format is one async job: `POST create` → task id → poll → download mp4. Per shot it sends: `prompt`, `negative_prompt`, `media[]`, and `parameters{duration, resolution 720P, ratio 16:9, seed, prompt_extend, watermark, audio}`.

| ATAS call / field (file) | What it carries | Our H3 equivalent (`/connector/generate`, `modelId: minimax-h3-ref2va`, op `ref2v_ms`, or `minimax-h3` ops `t2v_ms` / `i2v_ms`) | Gap |
|---|---|---|---|
| `media: reference_video` = rendered point-cloud video of the target camera (`client.py:_r2v_media_entries`, role `TARGET_GEOMETRY`) | THE core ATAS conditioning | `media:[{role:"inputVideo"}]` (Video 1-3, ≤3). Prompt tag `<Video 1>` | **H3 may not read it as geometry/camera.** Our only evidence: a reference clip transfers *motion* and can be *edited* (ref2va.md, MPI-1033). Never tested with a grey, holey point-cloud render. Unproven. Also ~4-5x slower (see 4) |
| `reference_image` = character cast stills (`CHARACTER`, ≤5 total, `WAN30_REFERENCE_CAP`) | identity | `inputImage`..`inputImage9` (≤9), tags `<Picture n>` | none; H3 is better here (9 vs 5) |
| `reference_image` = previous-shot last frame / re-drawn opening still (`CONTINUITY_MEMORY`, `FIRST_FRAME`) | same-place continuity | a `<Picture n>` ref (ref2va: refs never become frames), or `minimax-h3` `i2v_ms` first frame | r2v cannot pin the first frame (docs: "references never become frames"); i2v can, but then no video/char refs. Pick one per shot |
| `first_frame` alone (image-only requests) | I2V | `minimax-h3` `i2v_ms` | ok |
| `first_clip` (continue from previous clip's tail) (`_continue_media_entries`) | video extension | none | **H3 has no extension mode.** Fallback: last frame as first-frame i2v |
| `parameters.duration` 2-15 s whole seconds | length | `duration` seconds; frames land on a 17k+5 grid at 24 fps, trained range 124-362 frames (about 5-15 s) | clip may land off the requested length; sub-5 s shots are out-of-distribution |
| `ratio 16:9`, `resolution 720P` | canvas | `qualityTier` + `ratio`; native 1344x768 | map tier; do not go below native on r2v (docs) |
| `negative_prompt` | quality negatives | none (`negativePrompt:false`); negatives go inline at the end of the prompt (recipe) | rewrite |
| `seed` | determinism | `injectionParams` seed | ok |
| `prompt_extend`, `watermark` | Wan-only | n/a | drop |
| `audio` on/off (retry muted on DataInspectionFailed) | soundtrack | H3 always emits joint audio; `capabilities.audio` is OFF | cannot mute; fine, ATAS mutes only to dodge a Chinese content filter |
| `video_edit` geometry mode (`Wan30VideoEditClient`: `ratio=adaptive`, `duration=-1`, no first/last frame) | Wan 3.0 only, "experimental; never selected by production default" | none (no adaptive ratio, no follow-source-length) | **H3 cannot do it. Not a blocker**: ATAS's default path is `reference` mode |
| Prompt text: Chinese, with `@视频1` / `@图片1` handles (`generation.py:_prompt`) | prompt | English `<Video 1>` / `<Picture 1>` tags, `[Shot N]` syntax, our `minimax-h3.recipe.js` | **Rewrite every prompt template** (`prompt_author.py`, `generation._prompt`, compiler prompts are Chinese) |
| Submit/poll/download (`Wan27Client`) | HTTP job | `POST /connector/generate` returns `{running, jobId}`; poll via the connector status route; file path comes back, no download | small shim; our app owns the queue |

**Adapter size:** replace `Wan27Client` + `router.py` with one `H3Client` that builds a `/connector/generate` body, polls, and returns the path. About 300 lines plus the prompt rewrite. `ATAS_*` knobs for lanes and quotas disappear (one local queue, no 429s).

**Important packing option:** ATAS already has `geometry_reference_packing: "keyframes"` (up to 4 keyframes instead of a video). That maps to 4 `<Picture n>` refs on H3 r2v, which is the *cheap* path (11-14 s/step, not 44-52). Whether stills carry enough geometry for H3 is the other half of the spike.

## 3. Everything else it needs, and where it runs

| Dependency | What for | Fit with our stack | Verdict |
|---|---|---|---|
| **LLM gateway** `ATAS_LLM_URL` (Responses API, default `gpt-5.1`) | screenplay compile, camera plan, prompt author, film review (all VLM with frames) | `llm.py` has a **chat-completions fallback** when `ATAS_LLM_URL` is empty, using `OPENAI_BASE_URL` / `AVWM_IMAGE_BASE_URL`. DeepInfra serves `/v1/openai/chat/completions` (vision models, JSON mode). I found no sign DeepInfra serves the Responses API (unverified; moot given the fallback). Qwen3-VL-235B-A22B on DeepInfra: $0.20/M in, $0.88/M out | works on paper; **risk is quality**: prompts and strict JSON are tuned for GPT-5.1; Qwen compliance untested |
| **gpt-image-2 stills** (`gpt_image.py`, `imagegen.py`; used by `compiler/cast.py` for character references and `shot/prompt_author.py` for opening stills) | cast board + re-drawn first frames | `GPTImage2Generator` hard-rejects any other model name (`gpt-image-2 ... forbidden`); two call sites only. DeepInfra has `/v1/openai/images/generations` + `/edits`; Nano Banana 2 lite ≈ $0.034 / 1K image. Needs: lift the model check, send ONE reference per edit (DeepInfra keeps only the last of several, memory `deepinfra.md`) | small patch, but ATAS passes several references per still: needs a composite or a different approach. Medium |
| **Pi3X** (video → dense depth, camera, dynamic masks) | reconstruct EVERY generated clip, register, validate | code BSD-3; **weights CC BY-NC 4.0, "strictly non-commercial"** (yyfz/Pi3). We do not ship Pi3X; we ship MoGe (single-image depth) and SAM3 | licence blocker for a bundled feature; precedent for NC-gated models exists (Qwen-Image-2.1, MPI-936) but this one would sit inside a core pipeline |
| **SAM3** | dynamic-object masks | we already ship SAM3 (`sam3-multiplex`, SAM License, commercially OK per `assetDeps.js`) | fine |
| **Geometry service** (FastAPI, `run_geometry_service.sh`, `environment.snapshot.txt`: torch, **flash_attn, xformers, triton, open3d, numba, bitsandbytes**) | all of the above | Linux/bash oriented. Our rule (performance.md): no platform-specific wheel (Triton etc.) in the shipped engine. So it can never live in the user's embedded Python | **must run as a separate service**: on a Pod or the user's own CUDA box. Not a bundled feature |
| Vista4D | only its recon+seg code is bundled (Apache-2.0, diffusion part excluded) | no extra weights | fine |
| ffmpeg, opencv, pillow, imageio | media | already in our stack | fine |

**VRAM.** Geometry: "peak about 20 GB" in the default low-VRAM mode (24 windows, SAM3 offloaded); defaults demand `GEOMETRY_RECON_MIN_FREE_MIB=24576`. Whole-clip mode wants an 80 GB card. H3 itself: about 21 GB transformer + 25 GB encoder (host RAM about 45 GB at peak), runs on a 16 GB card only by streaming.
- **16 GB card (Fabio's 4060 Ti, the photographer tester's 3060): geometry does not fit** (20 GB peak). H3 alone runs, slowly. Smaller Pi3X windows might squeeze it in; untested.
- **32 GB (5090): fits, but not at the same time as H3.** Run them in turns (geometry ~100 s per shot, then unload, then H3). Add a model swap per shot.
- Realistic home: **a 5090 Pod** (RunPod secure $1.19/h) running both, or H3 on the user's card + geometry on a Pod.

## 4. Cost and time for one real test story

Assumed story: 6 shots × about 6 s (a 36 s film, 3 characters, 2 locations), as in the paper's efficiency table (6-7 shots/story). ATAS retries 0.54/shot with memory → about 9 H3 generations. Setup: 48 GB H3 + about 5 GB Pi3X/SAM3 downloaded once.

H3 time per shot. **Measured anchors** (4060 Ti 16 GB, ref2va.md): image-only refs 11-14 s/step; 1 image + 1 video ref at 1152x640: 44-52 s/step, stage 1 7-9 min for a 2-3 s clip; a 2688 sheet + ref video at 1152x640, `match` 7 min / `max` 12 min total. **Everything below for 6 s at 1344x768 and for the 5090 is my extrapolation** (no 5090 H3 ref2va timing exists in the repo; assume 3-4x a 4060 Ti):

| Packing | 4060 Ti 16 GB / shot | 5090 / shot |
|---|---|---|
| keyframes (images only) | about 10-15 min | about 3-5 min |
| point-cloud VIDEO ref | about 30-45 min (video ref tokens ride every step; 3x frames) | about 8-15 min |

| Scenario | H3 (9 gens) | Geometry (6 × about 100 s + swaps) | Wall | Money |
|---|---|---|---|---|
| **A. 5090 Pod, keyframes** | 0.5-0.75 h | 0.3 h | **about 1.5-2 h** with setup/load | about $1.19/h × 2 h + LLM/images ≈ **$3-4** |
| **B. 5090 Pod, video ref** | 1.2-2.3 h | 0.3 h | **about 2.5-3.5 h** | **about $4-6** |
| **C. Local 16 GB H3 + Pod geometry** | 4.5-6.5 h (video ref) | 0.5 h Pod | overnight | Pod ≈ $1-2 + LLM/images |
| D. Fully local 16 GB | n/a — geometry does not fit | | | |

Plus, in every scenario:
- **LLM:** about 75 VLM calls (about 8 per shot × 9 attempts), about 10k in / 1.5k out each → about 750k in, 110k out → **≈ $0.25 on Qwen3-VL-235B** (≈ $1.50 worst case). Add a re-run budget if Qwen mishandles ATAS's JSON.
- **Stills:** about 10-15 images via Nano Banana 2 lite ≈ **$0.35-0.50**.
- **First-run overhead:** Pod bring-up, 53 GB of downloads, geometry env (flash_attn / xformers builds) — plan 2-4 Pod hours of debugging on first contact ≈ **$3-5 more**.
- **Realistic first-story total: $8-15 and one working day**, mostly integration, not generation. These are estimates; no run has been made.

Engineering time (not money): the H3 client + prompt rewrite (Chinese → English `<Video n>` / H3 recipe) ≈ 2-3 days; swapping the LLM/image providers ≈ 1-2 days; getting the geometry service stable on a Pod ≈ 2-3 days. Total about 1.5 weeks before the first fair test.

## 5. Blockers, ranked

1. **Unproven core:** no evidence H3 follows a point-cloud reference video (or 4 keyframes) as geometry. Everything depends on this; Wan was instruction-tuned for it, H3 was not. Paper silent.
2. **No released H3 adapter and no published H3 inputs**, so we would be re-deriving an unpublished setup, and the +0.043 H3 gain is not reproducible from code.
3. **Pi3X weights are CC BY-NC 4.0** and sit in the hot path of every shot.
4. **Geometry service needs about 20 GB VRAM and a Linux/CUDA env with flash_attn/xformers/Triton** — cannot ship in the app engine and does not fit 16 GB cards. Must be a Pod/side service.
5. **Prompts are Chinese and Wan-shaped**; the LLM is tuned for GPT-5.1; stills are hard-wired to gpt-image-2.
6. H3 has no extension mode and no Wan-style `video_edit` (not on ATAS's default path).
7. H3 licence territory bar (EU/UK/USA/KR) — per Fabio, solved; not counted.

## 6. The spike that decides it (cheap, run only if Fabio says go)

On one 5090 Pod, ~1 h, ≈ $1.5, no ATAS code needed:
1. Pick a scene. Make a point-cloud render (or simply MoGe + a simple splat of one still, which MPI-623 already built) along a 6 s camera move.
2. Run `minimax-h3-ref2va` twice: render as `<Video 1>`, and render keyframes as `<Picture 2-5>`, plus a character sheet as `<Picture 1>`. Prompt in the H3 recipe.
3. Judge: does the camera move match, does the place stay the same, does the grey/holey render leak into the picture?

Pass → build the adapter. Fail → drop ATAS-on-H3 and keep MPI-1039 Multi-angle Flow as the consistency route (ATAS's real home is Wan 3.0 via DashScope, which Cubric does not run).

## Not verified

- DeepInfra Responses API support (searched, found nothing; not tested with a key).
- Any H3 timing on a 5090 or with a 6 s point-cloud reference (extrapolated).
- Qwen3-VL's ability to drive ATAS's JSON prompts.
- Pi3X peak VRAM below 20 GB at smaller windows.
- ATAS code was read, not run.

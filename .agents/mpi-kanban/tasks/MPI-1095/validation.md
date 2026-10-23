# MPI-1095 validation

## Stage 1: in-app GPU check (2026-10-22, session "LTX 2.5 model 5", Fabio approved)

Setup: own Electron instance (`app:isolated` launcher + a CDP port; own profile, port, `APP_DOCUMENTS`,
`CUBRIC_MODELS_ROOT=M:/CubricModels`), source run = dev mode, attached to the shared engine on 48188,
under the GPU lease. Driven through the real prompt box (model picker, op chips, settings panel, preview
toggle, CUE, the card's Finish button). Medium, 16:9 (960x512), 3 s, preview on unless noted.

Bars counted from ComfyUI's terminal log (`/internal/logs/raw`, the tqdm lines the app's stage counter
parses). An ATTACHED instance gets no ComfyUI stdout, so its own status bar shows no "Stage N/M" there;
the count is the engine's, not the status bar's.

| Op on LTX 2.5 | Mode | Bars | Time | Result |
|---|---|---|---|---|
| t2v (fisherman) | preview | 2 (1/1, 7/7) | 31 s | preview card |
| t2v | Finish | 1 (3/3), stage 1 cached | 21 s | 960x512 3 s + audio (waves, gulls) |
| i2v start | single | 3 (1/1, 7/7, 3/3) | 46 s | opens on the picture, she speaks |
| i2v start+end | preview | 2 | 31 s | |
| i2v start+end | Finish | 1 (3/3), cached | 26 s | last frame = the end picture |
| ref2v (sheet) | preview | 2 | 39 s | character matches the sheet |
| ref2v | Finish, UNCACHED (another job ran between) | 3 (1/1, 7/7, 3/3) | 71 s | 960x512 3 s + audio |
| t2v + Reference audio | preview | 2 | 28 s | |
| t2v + Reference audio | Finish, uncached | 3 | 45 s | talks to camera |
| i2v start + Original audio | preview | 2 | 24 s | |
| i2v start + Original audio | Finish, cached | 1 (3/3) | 23 s | lip-sync; output audio envelope follows the input voice (corr 0.64) |

- `progressStages` row for `ltx25_i2v_t2v.json` `{ single: 3, preview: 2, stage2: 3 }` MATCHES every
  uncached run. A Finish straight after its own preview gets 1 bar: ComfyUI serves stage 1 from its cache
  (70 nodes cached). Same on 2.3 Balanced (76 cached, 1 bar), so not a 2.5 issue; see brief `## Noticed`.
- Preview decoder: `taeltx2_3` DOES decode 2.5 latents. 592 live frames on the t2v preview, 222 on the
  Finish; a captured frame is a coherent picture of the scene. Keep the node and the `ltx23-preview-taehv` dep.
- Library (dev mode): LTX 2.3 (Balanced) and LTX 2.5 listed; 2.3 High gone. `/connector/models` agrees.
- 2.3 Balanced still runs: t2v preview 2 bars (52 s, incl. model swap), Finish 1 bar cached, 960x512 3 s + audio.

Clips (scratch, not shipped): `%TEMP%/claude/C--AI-Mpi-Cubric-Vision/71de6958-5825-49f5-b0e2-175d5a41bdf2/scratchpad/docs/Cubric Studio/Projects/LTX25 check/Media/`.

## R2 upload (2026-10-22, Fabio yes, ~$0.62/mo)

All six LTX 2.5 deps on `cubric-models/vision/models/<filename>`, one at a time at `--bwlimit 3M`, 19:24-23:04.
`rclone lsl` size = local size for every file, rclone md5 verify passed (0 errors in the log). Source staged in
`M:/_stage/mpi1095` (outside the models root); deleting it was blocked by the safety check, Fabio removes it.

DiffVAE (2026-10-23, Fabio yes, ~$0.02/mo): `vae/ltx-2.5-video-vae-bf16.safetensors` uploaded 11:43-11:51 from
`M:/_stage/mpi1095/vae/` at `--bwlimit 3M`. `rclone lsl` 1,472,223,346 B = local; `rclone check` 0 differences.

## Turbo switch in the app (2026-10-23, Fabio yes, two runs under the GPU lease)

`app:isolated` (own profile + port, dev mode, attached to engine 48188), `/connector/generate` ltx-25 `t2v_ms`,
very_low 16:9 (768x448), 2 s, seed 4242. `/connector/models` lists `turbo` on all three ltx-25 ops.
- `turbo:true`: engine prompt `e4c2c705` sent `Input_is_Turbo: true`; log loaded ONLY
  `ltx-2.5-video-vae-conv-bf16` (VideoVAE). 98 s incl. cold model load.
- `turbo:false`: prompt `b7cc703e`, `Input_is_Turbo: false`; log loaded ONLY `ltx-2.5-video-vae-bf16`
  (`CausalDiffusionVAE`). 47 s warm.
- Both clips 768x448, 48 frames + audio, the same lizard, clean picture. The lazy MpiIfElse loads one VAE per run.
- Open: the `h3Turbo` button's tooltip text is H3's ("6 steps instead of 25"); `PromptBoxControls.js` held by a peer.

## DiffVAE A/B (2026-10-23, Fabio yes, local 4060 Ti, under the GPU lease)

`research/dfr/dino2k_dfr_prompt.json` (i2v_007's engine graph, seed 753222358, 2560x1472, 96 frames, node `1`
= `ltx-2.5-video-vae-bf16`) vs Fabio's `i2v_007` (project "LTX 2.5", conv VAE, 458 s in-app).

- Trap, cost two wasted runs: the captured graph's start-image path (node `514`, `input/mpi_staged/<hash>.png`)
  is deleted by the app after each run, and `MpiLoadImage` with `block_if_empty: False` then feeds a blank 1x1,
  so the graph silently becomes text-to-video (a dino on a hillside road). A path outside ComfyUI's
  input/output/temp also loads as missing. Fix: copy the start picture to `input/mpi1095_dfr/dino_start.png`.
- Valid run (prompt `9cd9a7dc`): start image loaded; total 659 s; VAEDecode (node 215) 173 s (two broken runs:
  167 s, 164 s); peak VRAM 15.9 GB of 16 (shared with Fabio's app). Sampling ran slower than the broken runs
  (325 s vs 226 s stage 1), so the total is not comparable with i2v_007's 458 s. The conv VAE decode was NOT
  timed; i2v_007's 458 s minus ~350 s of sampling and loads puts it near ~100 s, so DiffVAE ~ +60-70 s. Estimate.
- Look (agent, stills only): same scene, slightly different motion (the DiffVAE also encodes the start frame).
  Frame strip 60-84 on the shoulder: the conv clip's scales go blobby/rounded around frames 60-72 and recover
  by 78; the DiffVAE clip keeps a crisper, more consistent polygon pattern across the same frames. Morphing is
  temporal: Fabio's eye-test on `research/dfr/scales_ab_old-left_dfr-right.webm` (old left, DiffVAE right)
  and `full_ab_old-left_dfr-right.webm` decides. Output: engine `output/mpi1095_dfr/dino2k_dfr_img_00001.mp4`.

## Turbo on/off - Fabio's in-app eye-test (2026-10-23, "LTX 2.5 model 7")

- PASSED, Fabio's own test in his app, project "FLUX3 Flow Bench", i2v 4 s, medium (704x1216), same start frame.
  Turbo ON (conv VAE, `i2v_003`) 1 m 17 s: a lot of floor-tile morphing. Turbo OFF (DiffVAE default, `i2v_002`)
  1 m 52 s: barely any. Fabio: "turbo works fine". Also confirmed: the medium resolution and the LTX ladder move.
- Cost of quality at this size: DiffVAE ~ +35 s (+45%) over conv; at 2K it was ~ +60-70 s (estimate, above).

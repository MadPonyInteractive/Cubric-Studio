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

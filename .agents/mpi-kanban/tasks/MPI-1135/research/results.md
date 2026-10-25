# MPI-1135 bench results

RunPod RTX PRO 4500 (32 GB), volume `cubric-h3-bench`. Rows appended by `step0/run_graphs.py`.
Seconds = ComfyUI execution start to success (models may already be resident from the clip
before). VRAM / RAM = peak used on the box while the clip ran, sampled every 2 s from
`/system_stats` (includes whatever is resident, so read it as "fits / does not fit").
Clips live outside git (`C:/AI/Mpi/_private/mpi1135-clips/`).

## Step 0: upscale arms on our H3 (Shots A + C, 1344x768, 4 s, stage-1 turbo)

| clip | ok | s | VRAM GB | RAM GB | MB | error |
|---|---|---:|---:|---:|---:|---|
| step0_ours_A_1135001 | ok | 372 | 23.9 | 25.4 | 1.9 | weights read off the network volume (Pod 1, superseded by the row below) |
| step0_ours_A_1135001 | ok | 114 | 23.9 | 26.7 | 1.9 |  |
| step0_none_A_1135001 | FAIL | 399 | 31.1 | 31.5 | 0.0 | graph bug: stage 2 ran at 2688x1536, no stage-1 save (fixed, re-run below) |
| step0_benji_A_1135001 | ok | 140 | 24.0 | 27.9 | 2.2 |  |
| step0_none_A_1135001 | ok | 125 | 24.0 | 30.2 | 1.8 |  |
| step0_ours_A_1135002 | ok | 113 | 29.3 | 52.3 | 2.0 |  |
| step0_none_A_1135002 | ok | 127 | 24.0 | 30.4 | 1.9 |  |

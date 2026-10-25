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
| step0_benji_A_1135002 | ok | 142 | 29.2 | 51.2 | 2.2 |  |
| step0_ours_C_1135001 | ok | 115 | 26.5 | 32.0 | 3.1 |  |
| step0_none_C_1135001 | ok | 162 | 27.3 | 32.1 | 3.5 |  |
| step0_benji_C_1135001 | ok | 210 | 30.1 | 51.5 | 3.2 |  |
| step0_ours_C_1135002 | ok | 94 | 24.0 | 29.8 | 3.8 |  |
| step0_none_C_1135002 | ok | 164 | 27.3 | 32.3 | 3.7 |  |
| step0_benji_C_1135002 | ok | 210 | 30.2 | 54.2 | 4.5 |  |
| b485_ours_C_1135001 | ok | 208 | 25.6 | 28.1 | 3.3 |  |
| b485_ours_C_1135002 | ok | 174 | 21.8 | 27.5 | 4.8 |  |
| b485_sing_C_1135001 | ok | 195 | 25.6 | 31.0 | 5.1 |  |
| b485_sing_C_1135002 | ok | 173 | 21.8 | 27.1 | 5.4 |  |
| p1_sing_none_A_1135001 | ok | 123 | 23.9 | 26.9 | 2.1 |  |
| p1_sing_ours_A_1135001 | ok | 110 | 28.9 | 47.2 | 1.9 |  |
| p1_sing_none_A_1135002 | ok | 120 | 24.0 | 30.4 | 2.1 |  |
| p1_sing_ours_A_1135002 | ok | 108 | 28.9 | 49.1 | 2.2 |  |
| p1_sing_none_B_1135001 | ok | 120 | 24.0 | 31.0 | 4.0 |  |
| p1_sing_ours_B_1135001 | ok | 105 | 29.3 | 50.2 | 4.1 |  |
| p1_sing_none_B_1135002 | ok | 119 | 24.0 | 29.5 | 4.2 |  |
| p1_sing_ours_B_1135002 | ok | 106 | 28.9 | 49.2 | 3.3 |  |
| p1_sing_none_C_1135001 | ok | 154 | 26.7 | 31.4 | 2.6 |  |
| p1_sing_ours_C_1135001 | ok | 125 | 30.2 | 53.6 | 3.4 |  |
| p1_sing_none_C_1135002 | ok | 160 | 27.3 | 32.4 | 3.1 |  |
| p1_sing_ours_C_1135002 | ok | 126 | 29.3 | 54.6 | 5.2 |  |
| p1_sing_ours_Cb_1135001 | ok | 113 | 25.5 | 32.4 | 3.6 |  |
| p1_sing_ours_Cb_1135002 | ok | 91 | 23.9 | 28.5 | 5.7 |  |
| p1_sing_ours_Cs_1135001 | ok | 114 | 25.6 | 32.4 | 3.7 |  |
| p1_sing_ours_Cs_1135002 | ok | 92 | 23.9 | 28.9 | 4.8 |  |
| p1_sing_none_D_1135001 | ok | 128 | 25.5 | 32.4 | 2.7 |  |
| p1_sing_ours_D_1135001 | ok | 112 | 29.0 | 53.9 | 2.5 |  |
| p1_sing_none_D_1135002 | ok | 129 | 25.8 | 32.4 | 2.9 |  |
| p1_sing_ours_D_1135002 | ok | 112 | 29.0 | 53.9 | 2.5 |  |
| p1_ours_none_B_1135001 | ok | 121 | 24.0 | 31.0 | 3.6 |  |
| p1_ours_ours_B_1135001 | ok | 105 | 29.0 | 51.0 | 3.7 |  |
| p1_ours_none_B_1135002 | ok | 120 | 24.0 | 31.2 | 4.2 |  |
| p1_ours_ours_B_1135002 | ok | 106 | 29.4 | 51.5 | 3.5 |  |
| p1_ours_none_D_1135001 | ok | 130 | 25.7 | 32.5 | 2.5 |  |
| p1_ours_ours_D_1135001 | ok | 112 | 29.2 | 53.8 | 2.4 |  |
| p1_ours_none_D_1135002 | ok | 129 | 25.5 | 32.1 | 2.7 |  |
| p1_ours_ours_D_1135002 | ok | 111 | 29.0 | 54.0 | 2.4 |  |
| p1_ours_ours_Cb_1135001 | ok | 115 | 25.5 | 32.6 | 3.2 |  |
| p1_ours_ours_Cb_1135002 | ok | 92 | 23.9 | 28.9 | 4.0 |  |
| p1_ours_ours_Cs_1135001 | ok | 114 | 25.7 | 32.6 | 3.3 |  |
| p1_ours_ours_Cs_1135002 | ok | 92 | 23.9 | 28.9 | 3.8 |  |

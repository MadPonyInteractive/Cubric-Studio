# MPI-1335 Validation

## Step 2b lip bench (2026-10-29, Fabio's RTX PRO 4500 Pod, through his app)

`ref2v_004` (5.9 s, 141 frames) + `edit_002`, "the woman" into the picture's room (template 6), 768p,
positive empty, H3 Reference. Project "MPI-1335 lip bench". Graphs + runner + measure:
`research/lipbench/` (`build_variants.py`, `run_bench.py`, `mouth.py`, `bench.log`, `bench2.log`).
~7.6 min a run.

Mouth measure (`mouth.py`, MediaPipe inner-lip gap / mouth width per frame): corr with the source's curve,
best lag, and mean opening on the source's quiet frames (103 of 141) vs speaking ones.

| Run | card | corr@0 | lag | quiet / speaking |
|---|---|---|---|---|
| source | ref2v_004 | 1.00 | 0 | 0.030 / 0.092 |
| V1 as shipped | flowVideoEdit_001 | -0.03 | - | 0.128 / 0.111 |
| V2 soundtrack into H3 | flowVideoEdit_003 | **0.98** | 0 | **0.031** / 0.119 |
| V3 swap LoRA on | flowVideoEdit_002 | -0.03 | - | 0.152 / 0.175 |
| V4 both | flowVideoEdit_004 | **0.97** | 0 | **0.034** / 0.114 |

**Verdict (agent): cause 1 is THE cause. Feeding the clip's soundtrack to H3 (with 17 frames of silence for
the template-6 lead-in) locks the mouth to the source and shuts it in the pauses. The swap LoRA does nothing
for the lips.** Frame check: V2/V4 show the swapped-in character, not a copy of the source, so the 0.98 is
real tracking. Fabio's ear still judges (H3 rule).

Bench caveats: V1/V2/V4 ran on seed 3362804242 (pinned in-graph, node 17 renamed; the app overwrites
`Input_Seed` on every Flow run and ignores a submit's `seed`, and the cards' sidecars record the random seed
it WOULD have used). V3 ran on 361637247. First V2/V4 tries failed in validation: MpiMath has ONE output.
After the bench, a no-lead-in branch (node 303, lazy MpiIfElse on node 45) was added for the masked route
and the video's room, where a 0 s EmptyAudio would fail. Not yet run.

## Soundtrack graph (V2) on the other routes (same Pod, `run_more.py`, `bench3.log`)

Peak Pod RAM / VRAM sampled every 10 s from `/remote/pod/stats` (62 GB RAM, 32 GB VRAM). All 141 frames,
audio 5.875 s = the source.

| Run | card | time | peak RAM / VRAM | corr@0 | lag | quiet / speaking |
|---|---|---|---|---|---|---|
| shipped, masked hair 768p (MPI-1331) | flowVideoEdit_005 | 216 s | 58.9 / ~33 GB | 0.50 | -8 best | 0.029 / 0.055 |
| S1 soundtrack, masked hair 768p | flowVideoEdit_006 | 168 s | 58.6 / 33.4 GB | 0.73 | 0 | 0.032 / 0.093 |
| S2 soundtrack, video's room 768p | flowVideoEdit_007 | 392 s | 58.9 / 33.4 GB | **0.98** | 0 | 0.045 / 0.124 |
| S3 soundtrack, picture's room 1080p | flowVideoEdit_008 | 1465 s | **61.1** / 33.5 GB | **0.98** | 0 | 0.027 / 0.118 |

**Fabio 2026-10-29: S2 and S3 "spot on, really good".** The no-lead-in branch (node 303) works (S1, S2).
Masked: the soundtrack raises the mouth from 0.50 to 0.73 at zero lag, but both masked runs show a SEAM
(plan.md § Masked route seam). 1080p on a 5 s window fits a 32 GB card but RAM peaked at 61.1 of 62 GB:
5 s at 1080p is about the ceiling for 62 GB of system RAM. Fabio's latent preview looked short on S3; the
output was full length (preview only).

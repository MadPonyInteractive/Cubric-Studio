# Bench 1, 2026-10-29: Video Edit, 3 chained windows, latent path (A) vs pixel path (B)

Local RTX 4060 Ti 16 GB, G:\ComfyUi bench on 8189, under gpu_lease. Scripts: `bench/bench.py <arm> <window> [quality]`
(one window), `bench/run_chain.py A:0 A:1 ...` (in order, under `gpu_lease.py run -- python ...`;
never `bash -c`, it resolves to WSL and exits 0 doing nothing), `bench/seams.py <arm>` (assemble +
measure; needs numpy). Start the bench first: `G:\ComfyUi\python_embeded\python.exe -s
ComfyUI/main.py --windows-standalone-build --port 8189` (~3 min to answer).

## Setup

- Source: "Video edit showcase" `ref2v_003.mp4` (a man talking, 311 frames, 768x1344, speech).
  Windows of 124 frames starting 0 / 85 / 170 (overlap 39 = `MpiH3MaskedPrefix` context 39).
- Graph: shipped `flow_video_edit.json` unchanged, per window: Swap the person, keep background
  (op 1, template 1, swap LoRA on), quality 1032192 (one pass, 768x1344, no refine), seed
  1150256869, `edit_002.png` (lava demon) as the picture, Look/Kept text from Fabio's run
  `flowVideoEdit_012`. Base weight = original H3 ref2va (what Video Edit ships), NOT Singularity.
- Windows 2-3 add `MpiH3MaskedPrefix(latent = node 110 latent, context_frames 39)` before node 115.
  A: context = previous window's SAMPLED latent (`MpiSaveLatent` -> `MpiLoadLatent`).
  B: context = previous window's output MP4 -> `MpiH3EncodeAV` (today's Extend Video route).
- Assembly: w0[0:124] + w1[39:124] + w2[39:124] = 294 frames, untouched source audio muxed.

## Results

| | A latent path | B pixel path |
|---|---|---|
| preserved head vs previous tail (mean abs diff, 0-255) | **1.0** | 2.5 |
| join frame diff (frame 124 / 209) | 2.66 / 2.50 | 3.47 / 3.35 |
| all-frame diff median / p95 | 4.40 / 6.61 | 4.37 / 6.45 |
| join diff / source motion, vs clip median, p99 | 1.81, 2.77 vs 1.31, 3.60 | 2.36, 3.71 vs 1.26, 3.72 |
| mean R channel, first -> last window | 56.6 -> 56.1 (flat) | 56.2 -> 50.9 (**-9 %, darkening**) |
| time per window | ~18.5 min | ~19.7 min |
| peak VRAM (nvidia-smi, whole card) | 15.7 GB | 15.7 GB |

- **Both join with no visible jump** (frame strip across join 2 looked continuous). Join diffs sit
  BELOW the clip's median frame-to-frame diff; the edit itself flickers more than any seam.
- **B already drifts after 3 windows** (darker, matches the OBVPM finding that pixel-path extend
  drifts). **A does not.** Winner for the primitive: **A, latent path**, same as Motion Context V2.
- VRAM number is not a ceiling: dynamic VRAM loading fills the card whatever the job. RAM not
  measured. The 2K question is still open (bench 2).

## Files kept for MPI-1348 (New H3 Upscaler session) - do not delete

`G:/ComfyUi/ComfyUI/output/latents/mpi1336_{A,B}_q1032192_w*.latent`,
`G:/ComfyUi/ComfyUI/input/mpi1336/` (`src_w*.mp4`, `{A,B}_q1032192_w*.mp4`, `chain_{A,B}_q1032192.mp4`,
`ref.png`). Fabio's eye and ear check: `chain_A_q1032192.mp4` vs `chain_B_q1032192.mp4`.

## Not done yet (next session)

1. Infinite Video case: Singularity v2, ref2v, a static talking shot, 3+ windows, arm A: drift.
2. 22-frame context row (Motion Context V2's value; our node refuses it today, audio off-step).
3. 2K per window on 16 GB (peak RAM too), and resume after a cancel mid-chain.
4. Mouth/lip lag per window vs source (MPI-1335's lip bench comes first).

# Bench 2, 2026-10-29: Infinite Video case, Singularity v2, 3 chained windows, latent path (A)

Local RTX 4060 Ti 16 GB, G:\ComfyUi bench on 8189, under gpu_lease. Scripts: `bench/run_inf.py 0 1 2`
(starts and stops the bench engine, runs `infinite.py` per window then `infinite_seams.py`). Run it as
`gpu_lease.py run --timeout 7200 -- python run_inf.py 0 1 2 > <ABSOLUTE path>/run_inf.log` (guard-claim
reads a relative redirect path literally and blocks it).

## Setup

- Graph: shipped `minimax_h3_r2va_singularity.json` (Singularity v2 int8), turbo OFF (shipped default,
  25 steps res_multistep), Fast Motion ON at 768x1344 = mode 0, one pass, no refine. Seed 1150256869.
- Reference: `input/mpi1336/sheriff.png` (= `mpi1033_sheriff_portrait.png`, still man, plain grey backdrop).
- Prompt: one scene line (static grey studio, locked-off camera) + one spoken line per window.
- Windows 124 frames; w1, w2 = `MpiH3MaskedPrefix(latent = 879 slot 1, context = previous window's
  SAMPLED latent from 565 via MpiSaveLatent/MpiLoadLatent, 39 frames)`. Assembly w0 + w1[39:] + w2[39:]
  = 294 frames, each window's OWN generated audio over the same span.

## Results

| | w0 | w1 | w2 |
|---|---|---|---|
| time | 583 s | 510 s | 508 s |
| peak VRAM (whole card, dynamic loading) | 15.7 GB | 15.7 GB | 15.6 GB |
| preserved head vs previous tail (0-255) | - | 0.90 | 0.88 |
| join diff (clip median 2.04, p95 8.62) | - | 3.31 | 2.60 |
| backdrop corners luma (pure grey, per window) | 91.7 | 88.5 | 86.0 |
| whole-frame luma / contrast (std) | 84.3 / 41.7 | 84.2 / 40.8 | 82.4 / 39.2 |

- **Joins invisible** (frame strip across both joins continuous; join diff under the clip's p95).
- **Drift is real on the static shot, even on the latent path:** the backdrop is flat inside a window
  and steps darker at each join, about -3.5 % per window (-6 % over 3), contrast -6 %, w2 backdrop picks
  a faint warm cast (B below G). Face and identity hold. Bench 1 (Video Edit) did NOT drift because each
  window re-reads its source slice; Infinite Video has nothing pinning it. Extrapolated, ~6 windows (30 s)
  would be visibly darker. This is the OBVPM static-shot finding, and the case for bridging or a
  colour anchor (e.g. grade-match each window to w0) on long Infinite Video runs.
- ~8.5 min per window at 768x1344 on the 4060 Ti (bench 1 estimate of ~19 min was the original-H3 graph).

## Extended to 6 windows (549 frames, 22.9 s), same settings, w3-w5 chained from w2

| window | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| backdrop corners luma (start 91.7) | 91.7 | 88.5 | 85.9 | 82.4 | 72.5 | 67.0 |
| whole-frame luma | 84.3 | 84.2 | 82.4 | 80.9 | 75.1 | 73.8 |
| backdrop R minus B (warm cast) | 3.2 | 2.3 | 2.3 | 4.6 | 5.0 | 8.3 |
| join diff (clip p95 8.28) | - | 3.31 | 2.60 | 3.94 | 4.69 | 3.50 |
| preserved head error (0-255) | - | 0.90 | 0.88 | 0.98 | 1.14 | 0.96 |

- **Drift compounds and speeds up:** -3.5 % per window for 3 windows, then about -10 % at join 4. The
  backdrop ends 27 % darker and brown; by window 6 it has a **speckled noise texture**, visible in a
  single frame (`inf_strip6.jpg` from `chain_inf_A.mp4` at frame 540). The face holds; the
  background breaks first.
- **Joins stay clean** throughout (every join under the clip's p95). So the failure is not the seam,
  it's the context getting worse each time: each window treats the slightly-off tail it was handed
  as ground truth, and errors pile up. **Plain chaining from one reference is good for about 3
  windows (~13 s) on a static shot, and unusable at 5-6.**
- Implication for the design: Infinite Video needs something that re-anchors every window to the
  original look. NOTE: every window ALREADY got the original reference image (node 321 -> 330), and it
  still drifted, so the reference alone does not hold the look against a 39-frame prefix. Candidates:
  (1) a shorter chain of context per window does not help (the tail is the carrier); (2) grade-match
  each window's context latent / decoded colour to window 1 (cures colour, maybe not texture);
  (3) bridging (render roots from the reference, fill between from both sides), which caps every
  frame at ~1 hop from a clean root; (4) a fresh-from-reference first frame per window instead of
  a prefix (loses motion continuity). Bench (2) and (3) before building the loop.
- Time 508-583 s per window; peak VRAM 15.6-15.7 GB throughout (one window resident).

Files: `G:/ComfyUi/ComfyUI/output/latents/mpi1336_inf_A_w{0..5}.latent`, `input/mpi1336/inf_A_w*.mp4`,
`input/mpi1336/chain_inf_A.mp4` (Fabio's eye and ear: joins, darkening, voice continuity at the joins).

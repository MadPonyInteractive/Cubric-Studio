# MPI-623 validation

## Green-light evidence: full-tier held-out bake (2026-10-05)

Fabio's gate (2026-09-14): no Vision wiring until he has seen a finished-tier result.
Draft (5 000) renders were rejected as not product quality.

**Run.** Brush v0.3.0, 30 000 steps on the staged swap157 root
(`D:\WORK\Images\Outputs\mpi623_swap157_brush`, 984 views: Q4_K_M Wan, rails
27/122/133/157), `MpiBrushTrain`'s flags (`--sh-degree 3 --max-splats 10000000
--max-resolution 2048`) plus `--eval-split-every 8 --eval-every 15000
--eval-save-to-disk`. Under the GPU lease, Fabio's yes on the GPU.
Script `D:\WORK\MPI-623-spike\run_swap157_brush.py`, log `swap157_30k_run.log`.

- **48.1 min** on the 4060 Ti; `swap157_30k_30000.ply` **380 MB**; 123 held-out renders at
  15 000 and at 30 000 (`swap157_30k_out\eval_*`).
- Peak `brush_app.exe` working set **7.6 GB** (sampled every 10 s), under the ~11.5 GB the
  `max_resolution` comment in `splat.py` estimates for 984 views at 2048 - this run trains
  on 861. Peak total GPU memory **5.9 GB** (incl. ~1.1 GB desktop).
- Held-out PSNR vs ground truth (render upscaled to the 2048 original), `sheet_30k.py`:

| | mean | rail 27 f0/f2 | rail 122 f0/f2 | rail 133 f0/f2 | rail 157 f0/f2 |
|---|---|---|---|---|---|
| Draft 5 000 (amendment 42, max-res 1920) | 28.88 | 29.28 / 26.62 | 25.82 / 21.90 | 28.24 / 25.19 | 27.40 / 26.68 |
| 15 000 | 31.12 | 32.95 / 28.43 | 28.28 / 22.62 | 31.77 / 26.53 | 29.57 / 28.18 |
| **30 000** | **32.28** | 34.06 / 29.49 | 28.70 / 23.70 | 32.80 / 28.50 | 30.46 / 28.81 |

  The scorer reproduces amendment 42's Draft table to 0.01 dB, so it is the same metric.
  Every rail/face cell rises from Draft to 30 000.

**By eye (sheets in `D:\WORK\MPI-623-spike\3d-scene-30k-deliverables\`).** Wide views match
truth closely; rail 157's graffiti wall at full resolution is near-identical. Failure modes:
objects close to the camera (the arcade cabinet) ghost and smear, floor debris softens,
fine plaster grain smooths away, and rail 122 owns all four worst views - one pose sits
against a wall and renders as fog. Against the Wan-free control (different reconstruction,
paired by ground-truth content, scores not comparable across the two), Wan removes the
black-rimmed disocclusion holes and keeps near objects sharper.

This run holds 1 view in 8 back; the product node trains on all of them.

**Verdict (Fabio, 2026-10-06): NO green light yet - the test scene is the problem.** The
rubble-and-graffiti room is hard to read even in the ground truth, so it is a poor quality
benchmark (it was only ever Phase 0's free CC0 8K pano). Realism (a living room, a bedroom)
is doubtful on this evidence; a 3D or 2D cartoon world may suit the pipeline well.

## `max_resolution` 2048 vs 1920 (2026-10-05, Fabio's yes)

Same swap157 root, 5 000 steps, identical flags and seed (42) except `--max-resolution
2048`, against amendment 42's 1920 run - so the 123 held-out views are the same.
`run_swap157_brush.py` -> `swap157_5k_2048_out\`, scored by `maxres_check.py`
(`maxres_check_result.txt`): each render against the 2048 original (1920 upscaled), and
again with everything downscaled to 1920.

- 6.0 min (1920 run: 6.3), 52.1 MB `.ply` (52.2), peak RAM 7.5 GB, GPU 3.5 GB.
- **No measurable gain at Draft.** Face 0 27.72 -> 27.72, face 2 25.02 -> 24.93, face 4
  33.89 -> 33.44; all 123: 28.88 -> 28.69 (-0.19 dB); 2048 wins 55/123. Both scorings
  agree to 0.01 dB, so this is not a resolution artefact of the metric.
- **Untested:** whether 2048 pays at the full tier, where the splat can resolve finer
  detail - that needs a ~48 min 1920 bake against `swap157_30k_out`.
- The `splat.py` comment's ~11.5 GB for 984 views at 2048 is not what Brush holds:
  measured 7.5-7.6 GB working set at 2048 (861 training views).

**Decision (Fabio, 2026-10-05):** keep the 2048 default; the full-tier test is skipped.

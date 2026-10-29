# MPI-1350 validation

## 16 GB: auto == the old ladder

`tests/test_windowed_auto.py` (MpiNodes d503a6d): every ladder bucket edge at 14-16 GiB usable
gives the graphs' MpiMath number, evaluated through `safe_math` on their exact string. All six
H3 graphs carry Window Frames "0" (094b1c7d8, eab7cc055). `npm run lint` + `npm test` green.

## 12 GB, simulated on the 16 GB bench (2026-10-29)

Local RTX 4060 Ti 16 GB, G:\ComfyUi on :8191, under gpu_lease. A ballast process held 4091 MiB
(touched every 0.5 s so WDDM keeps it resident), so the engine both saw and could use a 12 GB
card. Graph: shipped `flow_h3_upscale.json` (fl2va int8 + 8-step turbo LoRA, 3 refine steps),
576x1024 -> 1152x2048 (2.36 M px, the ladder's 90-frame bucket). Script + raw output:
`research/capped_bench.py`, `capped_results.json`, `engine_8191.log`.

| job | frames | window | result | sampling | wall |
|---|---|---|---|---|---|
| auto | 124 | auto -> ceiling **64** (10.0 GiB usable, x0.71) -> 3 windows of 56 | OK | 9 x ~52 s | 592 s |
| p90 | 90 | single pass | OK | 3 x 96.5 s | 381 s |
| p107 | 107 | single pass | OK | 3 x 125.5 s | 477 s |

- **Auto is safe at 12 GB.** It picked 64 frames, not the handoff's 77: the desktop holds about
  1.2 GiB on a real 12 GB card too, so usable was 10.0 GiB, not 12.
- **Auto is conservative at 2K.** 107 frames passed in ONE pass at the same cap: 1.7x auto's
  ceiling, and above the 16 GB ladder's own 90. The edge sits above 107 frames; it was not found.
- **No spill.** Step time grows smoothly with tokens (27 -> 32 latent frames: x1.30, between
  linear and quadratic), and there is no OOM retry in the log. "GPU Adapter Memory\Shared Usage"
  read ~26.8 GiB in every job, the same in all of them: that is dynamic-VRAM staging (TE 25 GB,
  model 20 GB staged), not a spill signal.
- **Why conservative:** the ladder is per BUCKET. 90 frames has to hold up to 6 M px, and 2K is
  2.36 M px, so at 2K the window carries about 2.5x fewer tokens than the bucket's worst case.
  Auto scales by memory only, so it inherits that slack. Cost: windows that could be one pass
  (124 frames took 592 s in 3 windows; 107 frames in one pass took 477 s).

# MPI-1350 validation

## 16 GB: auto == the old ladder

> Superseded 2026-10-30: this describes d503a6d. MpiNodes 5000dc1 replaced the ladder-scaled rule with the pixel-frames rule (section "Speed probe and the pixel-frames auto"); auto no longer equals the 16 GB ladder.

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
- **Seams clean** (`research/seams.py`): in the 3-window auto run, the frame-to-frame change at every
  window edge is 0.86-1.16x the source's own motion (median 1.06, max 1.52 at frame 122, the clip's
  end, not an edge). Frame 92, mid-overlap, is as sharp as the 107-frame single pass's frame 92;
  no ghosting.
- **The limit is a speed cliff, not an OOM** (edge search, `research/edge_bench.py`, stopped
  2026-10-29). Same 12 GB cap, 2K, a 158-frame single pass: the first step took 612 s, against
  ~125 s at 107 frames. GPU at ~11 % in spikes, 25 GB shared: activations push the weights out
  and every step streams them over PCIe. It would survive, three times slower.

  | window | latent | s per step | s per output frame (3 steps) |
  |---|---|---|---|
  | 56 x3 (auto, 22 overlap) | 17 | 52 | 3.8 |
  | 90 single | 27 | 96.5 | 3.2 |
  | 107 single | 32 | 125.5 | 3.5 |
  | 158 single | 40 | 612 | 11.6 |

  Fastest at 12 GB / 2K is ~90 frames: about 15 % faster than auto's 64. Past the cliff
  (between 107 and 158), it costs 3x. Overshooting costs far more than undershooting.
- **Why conservative:** the ladder is per BUCKET. 90 frames has to hold up to 6 M px, and 2K is
  2.36 M px, so at 2K the window carries about 2.5x fewer tokens than the bucket's worst case.
  Auto scales by memory only, so it inherits that slack. Cost: windows that could be one pass
  (124 frames took 592 s in 3 windows; 107 frames in one pass took 477 s).

## Speed probe and the pixel-frames auto (2026-10-30)

`research/speed_probe.py`: two steps per window size, single pass, step-2 seconds.

| picture | card | 90 | 107 | 124 | 141 | 158 | 175 | 192 | 209 |
|---|---|---|---|---|---|---|---|---|---|
| 2K (2.36 M px) | 12 GB (10.5 usable) | 97 | 122 | 157 | 401 cliff | | | | |
| 2K | 16 GB (14.6 usable) | | 112 | 135 | 167 | 201 | 240 | 282 | OOM |

1 MP (1.03 M px) at 16 GB: 243 = 111 s, 311 = 159, 379 = 222, 447 = 296. No cliff.
107 frames at 2K and 243 at 1 MP take the same step time: **pixel-frames set both cost and memory**.
Above ~250 M px-frames the cost per frame keeps rising, and below it it is about flat
(124 frames at 2K: one pass 471 s, 3x56 windows 468 s). So bigger windows do not save time.

New auto (MpiNodes 5000dc1, pinned a2ab9e956) = min(fastest ~250 M px-frames, what the card
holds = (usable - 3 GiB) x 0.9 x 39 M px-frames/GiB), floored at 3x overlap where memory allows.
2K: 12 GB 64 -> 105, 16 GB 90 -> 105. 4K at 16 GB: 39 -> 48. Long 960x544 clips now window (478).

**Re-bench** (`research/rebench.py`, 294 frames at 2K, old ceiling then new auto, one engine):

| card | old | new auto | time old | time new |
|---|---|---|---|---|
| 12 GB | 64 -> 8 x 56 | 105 -> 4 x 90 | 1438 s | 1279 s |
| 16 GB | 90 -> 4 x 90 | 105 -> 4 x 90 | 1301 s | 1158 s |

At 16 GB the plan is identical (294 frames equalises to 4 x 90 either way), yet the second job is
143 s faster: it reuses the cached text encoder and VAE encode. Allowing for that, the 12 GB gain is
~16 s. **New auto is no slower, and not meaningfully faster on this clip.** The gain lands where
the old ladder over-split (12 GB at 2K on clips that now fit fewer windows) or never windowed.
Seams (`seams_rb_*_new.txt`): edge ratios 0.84-1.16, max 1.47 at frame 126, not an edge.

Noticed: on the second job in one engine, auto read 10.3 GiB usable on the 16 GB card (the
probes read 14.6). At 2K the speed cap still binds (105); at 4K it would pick ~30, not 48:
safe, slower. `usable_vram` was not changed by this card.

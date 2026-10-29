# Bench 3, 2026-10-29: Infinite Video by BRIDGING, Singularity v2, 3 roots + 2 bridges

Local RTX 4060 Ti 16 GB, G:\ComfyUi bench on 8189, under gpu_lease. Scripts: `bench/run_bridge.py r1 r2 b0 b1`
(`bridge.py` per window, then `bridge_seams.py`), `bench/cuts.py` for hard cuts inside a clip. Graph:
`bench/graph_bench2.json` = the shipped `minimax_h3_r2va_singularity.json` at d37408109, i.e. bench 2's exact
graph (the shipped file had a peer's uncommitted v1.1 turbo-LoRA rename that fails validation).

## Setup

- Same as bench 2: turbo OFF, 25 steps, Fast Motion ON at 768x1344 = one pass, seed 1150256869, sheriff portrait.
- Roots: 124 frames, independent from the reference, SAME seed/length/canvas, full scene prompt + lines 0, 2, 4.
  Root 0 = bench 2's `inf_A_w0` (identical settings and line).
- Bridges: 192 frames (8 s: first length on both the 17k+5 grid and the audio clock that holds 39 + 39),
  `MpiH3MaskedPrefix` head = root n's last 39 frames, tail = root n+1's first 39 (MpiNodes `3ef5c5d`), 114 sampled.
  Run 1 prompt: SHORT, OBVPM-style ("The man from <Picture 1>, one single continuous shot, no cuts, locked-off
  camera. He says, "<line 1 or 3>"").
- Assembly r0 + b0[39:153] + r1 + b1[39:153] + r2 = 600 frames (25.0 s), each part's own audio.
  `input/mpi1336/bridged_inf.mp4`.

## Run 1 results (short bridge prompt)

| | time | peak VRAM |
|---|---|---|
| root (124 f) | 532-580 s | 15.7 GB |
| bridge (192 f) | 1030-1081 s | 15.6-15.7 GB |

Backdrop (two top corners, same measurement on both runs; speckle = horizontal high-frequency energy):

| segment | r0 | b0 | r1 | b1 | r2 |
|---|---|---|---|---|---|
| backdrop luma | 92.9 | 89.5 | 99.4 | 86.5 | 90.2 |
| backdrop R-B | -0.1 | 0.1 | -0.1 | 0.6 | 0.2 |
| speckle | 0.29 | 0.37 | 0.28 | 0.85 | 0.24 |

| chain window (bench 2) | w0 | w1 | w2 | w3 | w4 | w5 |
|---|---|---|---|---|---|---|
| backdrop luma | 93.0 | 90.2 | 87.5 | 83.7 | 74.9 | 69.2 |
| backdrop R-B | -0.1 | -0.1 | 0.8 | 2.4 | 3.9 | 7.9 |
| speckle | 0.29 | 0.21 | 0.35 | 0.54 | 0.94 | 4.80 |

- **Drift is gone.** Across 25 s the backdrop wanders 86-99 with no trend and no warm cast, and the last root is
  as clean as the first (speckle 0.24). The chain at the same length is 25 % darker, brown, speckle 16x.
  Roots carry the look; bridges sit between them and cannot pass an error on.
- **Held ends are exact:** held head vs root tail 0.81-0.91, held tail vs next root's head 0.82-0.83 (0-255),
  the same as the chain's prefix. The tail mask lands on the right frames (VAE phase and audio clock right).
- **But both bridges HARD-CUT twice:** ~5 frames after the held head (frame 44/45, diff ~30 vs median 2-4) to a
  tighter close-up, and again entering the held tail (frame 153, diff ~40). The sampled middle is a different
  shot; H3 treats the masked ends as neighbouring shots, not as one take. The assembled joins b0->r1 and
  b1->r2 show the second cut (diff 40.8 / 38.1); r0->b0 and r1->b1 look clean (3.4 / 2.1) only because
  the first cut falls 5 frames later.
- Roots do not align their framing well either: same seed + length + canvas, different line -> r1 ends tighter
  than r0. The bridge has to absorb that.
- Suspect: the short prompt dropped the framing ("medium close-up, locked-off camera, plain grey studio") that
  every chained window had (chain windows show NO cuts). Run 2 tests the bridge with the full scene prompt.

## Run 2: bridge 0 with the roots' full scene prompt (`b0s`, 971 s)

- **The head cut is GONE**: the middle keeps root 0's framing and moves naturally (frame-diff median 1.80, no
  spike until the tail). The short OBVPM-style prompt was the cause: without the framing line H3 picks its own
  shot. Rule: a bridge prompt = the roots' SCENE line + "One single continuous shot, no cuts." + the spoken line.
- **The tail cut stays** (frame 153, diff 38): the middle has to land on root 1's opening, a DIFFERENT framing.
  Root openings differ from each other by 33-39 (0-255; r0 medium, r1 tight, r2 wide); a root's end differs
  from the next root's start by 30-38. Same seed + length + canvas does NOT align roots on Singularity: ref2va
  never sets keyframes, so nothing pins frame 0 and each line composes its own shot (`docs/models/h3/ref2va.md`
  "Composition is decided at the stage-1 canvas"). OBVPM's roots aligned because they shared a START IMAGE
  (i2v), which ref2va has no input for.

## Verdict so far

Bridging cures the drift (the reason it was tried) and the held ends land exactly. It cannot ship until roots
share a framing. Next: pin every root's first frame. Candidate: a video-only 1-step head on MpiH3MaskedPrefix
(one image encodes to exactly one latent step = the period's 1-frame step, so it is phase-exact; audio left
free), every root pinned to the same start frame (root 0's frame 0, or the reference). Then re-run r1, r2 and
both bridges with the scene prompt (~65 min local GPU).

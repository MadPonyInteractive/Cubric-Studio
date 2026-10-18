# MPI-1184 brief - ATAS world memory on MiniMax-H3

Umbrella: MPI-1179 (New Models to Test), phase 5. Researched 2026-10-18 from the repo
<https://github.com/ziplab/ATAS> (commit `b86aab0`, MIT), the paper arXiv 2610.20571 and the project
page <http://lhmd.top/atas>. **The full write-up is `research/atas-h3-scope.md`: read it before
touching this card.**

**Parked, not scheduled** (Fabio, 2026-10-18): we are not testing this now and may never test it.
This card exists so the findings are not lost. Do not build the adapter. Do not spend on the
spike unless Fabio asks.

## First step (when picked up): the spike, about 1 h and about $1.50

Not run. Needs Fabio's yes on the price first. One 5090 Pod (RunPod secure $1.19/h), no ATAS code:

1. Pick a scene and make a point-cloud render along a 6 s camera move (MoGe + a simple splat of
   one still, which MPI-623 already built, is enough).
2. Run `minimax-h3-ref2va` twice: the render as `<Video 1>`, then the render's keyframes as
   `<Picture 2-5>`. Both times a character sheet goes in as `<Picture 1>`. Prompt with the H3 recipe.
3. Judge: does the camera move match, does the place stay the same, does the grey, holey render
   leak into the picture?

Pass = build the H3 client. Fail = close this card with the findings. Full detail:
`research/atas-h3-scope.md` § 6.

## What it is

ATAS keeps ONE persistent world behind a multi-shot film. Each generated clip is reconstructed
(Pi3X + SAM3), registered and validated before it joins the world; later shots are conditioned on
renders of that world. It is a separate solution from the 3D Scene workspace, closer to
multi-shot / locale consistency (MPI-1039 Multi-angle Flow, MPI-623 is the exact-camera sibling).

## Verdict

**Do not build the adapter yet.** Run one cheap spike first (about 1 h on a 5090 Pod, about $1.50, no
ATAS code): does `minimax-h3-ref2va` follow a rendered point-cloud video, or 4 keyframes, as a
camera and geometry guide? Everything depends on that, and nothing published says H3 does.

## Key facts (details and tables in the research file)

- The paper lists MiniMax-H3 as one of four backbones but never says what H3 was fed. The released
  code has only Wan 2.7 / Wan 3.0 DashScope clients, no H3 adapter.
- H3 gain is about half Wan 3.0's: avg 0.659 -> 0.702 (+0.043) vs 0.648 -> 0.734 (+0.086);
  ViStory-Cross 0.508 -> 0.547 vs 0.481 -> 0.584.
- ATAS's core conditioning is a rendered point-cloud VIDEO passed as a Wan `reference_video`. Our H3
  slot for it is `inputVideo` on `minimax-h3-ref2va` (op `ref2v_ms`); untested for geometry, and a
  video ref makes H3 about 4-5x slower per step. ATAS also supports packing the geometry as up to 4
  keyframes, which maps to `<Picture n>` refs (the cheap path).
- H3 has no video-extension mode and no Wan-style `video_edit`; neither is on ATAS's default path.
- ATAS prompts are Chinese with `@视频1` handles: every template must be rewritten for H3.

## Blockers, ranked

1. H3 following a point-cloud reference is unproven.
2. No H3 adapter or published H3 inputs: the +0.043 cannot be reproduced from code.
3. Pi3X weights are CC BY-NC 4.0 and sit in the path of every shot (SAM3 is fine, we ship it).
4. The geometry service needs about 20 GB VRAM and a Linux/CUDA env with flash_attn, xformers and
   Triton: cannot ship in the app engine and does not fit 16 GB cards. Pod or side service only.
5. LLM (Responses API, gpt-5.1) and stills (hard-wired gpt-image-2): DeepInfra has chat
   completions (ATAS has that fallback) and image generation, no sign of the Responses API; quality
   with Qwen3-VL untested.

## Estimate for one test story (6 shots x 6 s, extrapolated, nothing was run)

About $3-6 of generation on a 5090 Pod ($1.19/h) plus about $0.25 LLM (Qwen3-VL-235B on DeepInfra) and
about $0.40 stills; a realistic first run is $8-15 and a working day, 1.5 weeks of engineering
before the first fair test. 16 GB cards cannot run the geometry service.

## If it is ever picked up

Run the spike in the research file, section 6. Pass = build the H3 client (about 300 lines) and
rewrite the prompts. Fail = close with findings; ATAS's real home is Wan 3.0 via DashScope, which
Cubric does not run, and MPI-1039 stays the consistency route. Weigh it against InfiniSplat
(MPI-1183): both are candidates for consistency and camera placement, both carry non-commercial
weights.

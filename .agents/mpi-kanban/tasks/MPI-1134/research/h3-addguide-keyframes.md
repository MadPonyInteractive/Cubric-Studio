# MiniMax H3 "Add Guide" node: keyframes at any frame (2026-10-18)

Fabio flagged the node from a screenshot (2026-10-18) as a building block for Infinite Video,
Story and Mix. Read off `G:/ComfyUi/ComfyUI/comfy_extras/nodes_minimax_h3.py:166-240`.

## What it is

Core ComfyUI node `MiniMaxH3AddGuide` ("Add Guide for MiniMax H3"). Not a new dependency: it has
been in the shipped engine since the MPI-591 bump, and `comfy_workflows/flow_h3_extend.json` already
uses it (the source's last 39 frames + their audio pinned at `frame_idx 0`).

| Input | Meaning |
|---|---|
| `positive`, `latent` | the H3 AV latent of the shot being made (its length fixes the frame count) |
| `image` (+ `vae`) | ONE picture, or a CLIP: a batch of 5+ frames is cropped down to 17k+5 (5, 22, 39...); under 5 frames only the first is used |
| `audio` (+ `audio_vae`) | soundtrack pinned from the same frame, cropped to what is left of the shot |
| `frame_idx` | PIXEL frame (24 fps) where the picture / clip's first frame lands; negative counts from the end |

Output is `positive` with one more entry in `minimax_keyframes`. **Chain N nodes = N anchors** in one
shot (the node's own description says so). `MiniMaxH3ImageToVideo`'s first/last frame uses the same
`minimax_keyframes` list, so first-last-frame is just the two-anchor case of this.

## What is proven, what is not

- PROVEN (MPI-591 Phase 5d): picture + 39-frame clip + its audio at `frame_idx 0` on the r2va
  weights. That is the shipped H3 Extend.
- PROVEN (MPI-1033): an audio anchor runs on r2va; a picture anchor holds the picture (SSIM 0.755
  vs 0.52 without).
- **NOT PROVEN: an anchor in the middle of a shot, or several anchors in one shot.** The only mid-shot
  try (MPI-591 F9, `frame_idx 51`) died on a third-party pack's patch, not on core; it was never
  re-run once the pack was removed. Also unknown: which weights (r2va / fl2va / t2va) honour mid
  anchors, and how hard the model swerves to hit them.
- Shot length caps it: trained range ~124-362 frames (5-15 s). "5-10 images, the model lands on
  each" fits ACROSS shots (a few anchors per shot), not 10 in one 5 s shot (one every half second
  is likely over-constrained). The bench decides the safe spacing.

## What it gives this umbrella

1. **A `keyframes` join / shot mode** (docs/story/continuity.md table): a shot's storyboard frames
   placed at chosen times inside it, so the Storyboard's pictures ARE the shot's beats. Fits the
   "planned stopping point": pin the planned end frame at `frame_idx -1`.
2. **`extend` is already this node** (clip anchor at 0). `lastFrame` can be a 1-frame anchor at 0
   on H3 Reference, keeping the refs, instead of an i2v op.
3. **Bridge two takes**: previous take's tail at `0`, next take's head at `-N`, the model makes the
   frames between. In Mix: fill a gap / smooth a bad cut between two clips on the video lane.
4. **Pin sound at a time**: a dialogue line or music segment from Mix anchored at its frame, the
   picture made around it (music video, line timing). MPI-1033 shows a sounded REFERENCE video can
   override the anchored audio - unwire it when the anchor must win.

## Bench before any of it ships

One H3 run per arm, stock core (no third-party H3 packs in `custom_nodes`), under the GPU lease:
(a) one mid anchor at ~half the shot; (b) 3 anchors in a ~10 s shot; (c) bridge: tail at 0 + head at
-22. Pass = each anchored frame matches its picture (SSIM) and the motion between does not jump.
Repeat (a) on r2va and fl2va weights.

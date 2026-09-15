# MPI-758 - Remove Background on video: rejected, never built

Closed 2026-09-15 during the MPI-757 brainstorm. Nothing was built and no code changed.

## Why

Fabio chose to scope background removal to GIFs only. The cut-out now lives in the GIF
workspace as SAM3 masking by name (see the MPI-757 plan, the "GIF cut-out with SAM3 by name"
member).

## If this comes back

Transparent video IS possible; only MP4 cannot carry it. What this card found still holds:

- `MpiSaveVideo` (ComfyUi-MpiNodes `video.py`) encodes `rgb24` -> `libx264 yuv420p`, so an
  alpha output needs a new save path, WebM VP9 with alpha being the obvious candidate.
- The gallery hover proxy `<id>.proxy.mp4` is h264, so a transparent clip would hover on a
  black backdrop; the WebP poster keeps alpha.
- mediabunny 1.50.8 exposes `alpha?: 'discard' | 'keep'`, unproven in our player.
- ComfyUI's `RemoveBackground` moves the whole frame batch to the GPU before its per-frame loop.
  `SAM3_VideoTrack` is the lower-memory route Fabio has used on 15 s 24 fps clips.

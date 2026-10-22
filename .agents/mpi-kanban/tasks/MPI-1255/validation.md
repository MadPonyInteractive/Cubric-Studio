# MPI-1255 Validation

## ResizeObserver loop (784 `[uncaught]` lines, 2026-10-22 21:00-21:08 UTC)

- The bursts did NOT come from the video Resize runs (21:09-21:13 UTC logged none). They sat
  around the Object Stamp Flow runs (removeBackground / flowObjectStamp files in FLUX3 Flow Bench).
- Reproduced in an `app:isolated` instance with an instrumented ResizeObserver: entering
  Object Stamp's "Place it" step fired 51 loop errors; the step's stage observer ran 52 times,
  one per frame, the stage growing 703.53 -> 754 px by exactly 1 px a frame.
- Cause: `.mpi-base-flow__canvas` is shrink-wrapped by `__work` (`align-items: center`), so a
  `width: 100%` stage measured its own canvas's width attribute, and `_syncCanvasSize` set that
  attribute from the stage (rounded up) - a ratchet to the column cap. Shared by every
  fixed-box step (Crop, Cut-out, Edges, Paint, Place).
- Fix: `.mpi-base-flow__work > .mpi-base-flow__canvas { align-self: stretch; }` (stacked form
  only; the side layout already sizes it by flex). Same rule injected live: 0 errors, observer
  ran once, stage lands at the same 756 px.

## Mascot warnings

- Gated behind `speed_diagnostics` (dev_configs/app_config.js) like `[slow-load]` / `[health]`,
  including the per-frame heartbeat that only fed them.
- Fabio's `studio frozen 8 s, waiting on connecting-sparks.webm` followed a pod connect that
  aborted (status=EXITED) before the scene's first frame: `crew` overtook it and the pending
  check fired. The band now counts as parked under the crew and pauses both clips.

## Checks

- `npm run lint`: clean. `npm test`: 3532 pass, 0 fail.

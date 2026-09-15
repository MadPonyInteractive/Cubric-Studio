# MPI-772 - GIF timing tools and output

Umbrella: MPI-757 (phase 4, before MPI-773: both edit `MpiHistoryTools.js` and
`MpiGroupHistoryBlock.js`). Read `tasks/MPI-757/plan.md` first; its decision table is settled.
**Needs MPI-769** (workspace) and MPI-768 (frames and builder).

## Scope

Every tool here rewrites only the frame list or the output settings: **zero new frame files**. Apply
on a tool saves a new GIF entry (the strip's Update/Apply pair is MPI-769's, not these tools').

| Tool | Behaviour |
|---|---|
| Trim | Keep the control bar's in/out frame range. |
| Speed | One frame rate for every frame, 0.1 to 50 fps. Below 1 fps is the slideshow hold (0.33 fps = 3 s per image). |
| Reverse | Reverse the frame list. |
| Loop count | Total plays, 0 = forever. Copy the total-plays -> ffmpeg `-loop` remap from `routes/videoGif.js` (0 -> 0, 1 -> -1, N -> N-1). |
| GIF output | Built `.gif` size (longest edge, default 1024), colour limit, **edge colour** (partial alpha blends into it before the on/off cut). Rebuilds the `.gif` only. |

## Facts to respect

- GIF delays are whole hundredths of a second. Chromium plays a delay of 0 or 1 hundredth as 10, so
  50 fps (2 hundredths) is the ceiling. 16 fps rounds to a 6-hundredth delay, which plays at 16.7 fps.
- The existing `MpiToolOptionsGif` panel shows the control and persistence pattern (fps, size preset,
  loop, `toolSettings` via `settings:tool:update`).

## Done when

Each tool applied to a real GIF adds an entry whose `.gif` has the expected frame count and delays
(ffprobe, command recorded beside the result), and the frame store's file count does not change.

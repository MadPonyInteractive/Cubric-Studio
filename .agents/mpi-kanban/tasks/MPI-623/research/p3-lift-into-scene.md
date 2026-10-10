# P3 attempt: a rendered path builds the 3D scene (session 45, 2026-10-10) - DROPPED

Kept so a later attempt (better depth models, a real 3D reconstruction, a sharper 360 video model) starts
from what was measured, not from zero. Numbers and rig: [../validation.md](../validation.md) § "P3: a
rendered path builds the scene - LIVE". Decision: [../plan.md](../plan.md) § Plan Drift 2026-10-10.

## What it did

Render path's Wan 360 video (81 frames, 1440x720 equirect, each frame at a known camera pose from
`pathFrames`) was turned back into scene layers, so the path "grew the world" the way the old automatic
rails (the bake) were meant to:

1. The video landed with no card (`enqueueGeneration(..., { deferCommit: true })`) and was recorded on
   the pano item as a rendered path: `renderedPaths: [{ id (the video item id), n, points, fillLine,
   frames, video (filePath), lifted, replaces? }]` (sidecar via `update-meta`, mirrored on the live item).
2. `liftPath`: frames `n-1, n-21, n-41, ...` (every 20th from the END - the new part first; frame 0 is
   the pano itself) came out of the video server-side (`POST /project-media/:id/video-frames`, ffmpeg
   `select='eq(n\,80)+...'` `-fps_mode passthrough`, PNGs placed in `.preview-assets`).
3. At each picked frame, the six Build here views (`buildPoses`, 16 mm, 512 px): render the scene
   (`renderPicture`); skip a view with no holes or no known depth; else cut the video frame to that
   exact view and lift it like a Take-picture fill (`MpiLiftDepth`: MoGe on the view, least-squares fit
   to the scene's known depth, kept on the holes), one layer per view, tagged `path: <id>` in the
   manifest. Each frame only filled what the frames before it left (they render first).
4. It ran on landing, else after a running picture/build, else at the next scene open (`liftPending`).
5. Panel row "Rendered paths": a picker (newest first, its balls drawn as a white ghost path), Re-render
   (the new video lands with `replaces: <old id>`; the old layers go just before the new are lifted),
   Delete pressed twice (`POST .../scene-path-remove` drops every layer with that tag + its files,
   manifest written first; then `view.removeLayers(id)`). `scene-layer` named layers past the highest
   number in use, since deletes leave gaps.

The cut (`stitchPano` backwards; the frame's centre = its heading `yaw`, world y-down):

```js
export function faceFromPano(pano, { yaw }, { w, h, w2c, fx, fy = fx, cx, cy }) {
    const R = [Math.cos(yaw), 0, -Math.sin(yaw)], F = [Math.sin(yaw), 0, Math.cos(yaw)];
    const out = new Uint8ClampedArray(w * h * 4);
    const px = (u, v, c) => pano.rgba[(v * pano.w + ((u % pano.w) + pano.w) % pano.w) * 4 + c];
    for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
        const x = (u + 0.5 - cx) / fx, y = (v + 0.5 - cy) / fy;
        const d = [0, 1, 2].map(c => w2c[c] * x + w2c[4 + c] * y + w2c[8 + c]); // ray in the world
        const r = d[0] * R[0] + d[2] * R[2], f = d[0] * F[0] + d[2] * F[2];
        const su = (Math.atan2(r, f) / (2 * Math.PI) + 0.5) * pano.w - 0.5;
        const sv = Math.min(Math.max((0.5 - Math.atan2(-d[1], Math.hypot(r, f)) / Math.PI) * pano.h - 0.5, 0), pano.h - 1);
        // bilinear between (floor(su), floor(sv)) and +1, u wrapping across the seam
    }
    return out;
}
```

Its test pinned: frame centre = the way it faces, a quarter turn right/left, 30 degrees right is right
(not mirrored), up = top row, straight behind = half way between the last and first column (wrapped).

## What it gave (live, his 5090 well video, 4060 Ti)

- 36 s for 23 of 24 views. 360 hole share at the lifted frames roughly halved (f40 53.6 -> 22.9%).
- Swap (Re-render) and Delete worked; Delete restored the scene EXACTLY.
- **By eye it failed** (Fabio: "This is making me rethink this whole 3D scene thing"): jagged edges,
  floating strips, cobbles doubled at two depths, soft patches.

## Why it fails (the same root cause as Build here's tearing, session 40)

- Every view's depth is a separate MoGe guess fitted to the scene; two views of one surface never land
  at the same depth, so overlapping layers show seams, doubles and floaters. Fitting each view only on
  "known" pixels cannot make independent guesses agree.
- Wan's frame is 1440 px for 360 degrees (~4 px a degree) against the 8K pano (~23 px a degree): every
  lifted part is ~6x softer than what is around it.
- Rule C keeps a stretched pano face that is NEARER than a layer, so part of what Wan invented stays
  hidden behind rubber sheets (~9-23% of the 360 still unfilled after the lift).

## What a later attempt would need

- ONE consistent geometry for all views, not per-view depth: e.g. a 3D reconstruction trained on the
  path video with its KNOWN camera poses (no SfM needed - `pathFrames` gives them), as Matrix-3D's own
  second stage does. The bake era's splats were streaky (Klein had to repair every frame), so judge a
  newer reconstruction model on that.
- A sharper 360 video model (Wan 2.1 + Matrix-3D LoRA is 720P), or upscaling the frames before use.
- The parts worth reusing: `faceFromPano` (above), the `renderedPaths` lifecycle, the frame picking from
  the end, Delete restoring exactly via the `path` tag.

## Kept from this session

- Short paths render fewer frames: `frameCount` (scenePath.js), 29 frames a camera height (the P2 window
  run: 81 frames over 2.78 camera heights), 4k+1, 33-81; the graph takes the guide's own count
  (`GetImageSize` -> `MpiWanMaskedVideo.length`). A/B on half the window path: 49 frames 805 s of Wan vs
  81 frames ~1700 s, known-pixel corr +0.974 vs +0.977 - same quality. Wan time ~ (frames/81)^1.5.
  `frameCount` is built and tested; wiring it into `renderPath` / the panel / `pathEtaMin` is next.

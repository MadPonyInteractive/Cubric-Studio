# GIF — frames store and builder (MPI-768)

Server-side foundation for GIF as its own kind (MPI-757 umbrella). No UI lives
here — see `docs/workspaces.md` / `docs/video-player.md` once MPI-769 lands the
GIF history workspace. This doc covers the data model, the store, the build/
extract recipe, and the routes every later GIF card (Make GIF, cut-out, timing
tools, transform, GIF Maker) calls.

## Data model

A GIF item is still an ordinary image sidecar (`Media/.meta/<uuid>.json`,
`type: 'image'`) — every surface that already plays a GIF (gallery, viewer,
export) keeps working unchanged. `filePath` points at the BUILT `.gif` in
`Media/`. The extra field:

```json
"gif": {
  "frames": [ { "hash": "<sha256>", "delay": 10 } ],
  "loop": 0,
  "output": { "maxEdge": 1024, "colours": 256, "edgeColour": null }
}
```

- **`frames[].hash`** — sha256 of a lossless, full-colour RGBA PNG in the
  content-addressed store (below). Order is playback order; the same hash may
  repeat (a frame reused at two points in the sequence costs zero extra bytes).
- **`frames[].delay`** — hundredths of a second (GIF's native unit). Never
  written under `MIN_DELAY_HUNDREDTHS` (2) — Chromium plays a delay of 0 or 1
  as 10, which reads as "my delay was ignored".
- **`loop`** — **total plays**, not ffmpeg's raw `-loop` value. `0` = forever,
  `1` = once, `N` = N plays. This is the SAME unit `routes/videoGif.js`'s body
  field already uses. ffmpeg's own `-loop` is the NETSCAPE "extra repeats"
  value (`0`=infinite, `-1`=none/once, `N`=N+1 plays) — `totalPlaysToRawLoop()`
  in `services/gifFrames.js` converts on build. Verified empirically
  (ffmpeg-static 6.1.1, sharp 0.34.5): `sharp(...).metadata().loop` ALREADY
  reports total plays, so extraction needs no conversion at all.
- **`output`** — the settings the CURRENT `.gif` was built with, so a later
  rebuild that doesn't override them reproduces it. `maxEdge` caps the longest
  side (never upscales); `colours` is the palette size (ffmpeg `max_colors`,
  default 256); **`edgeColour`** is `null` for a normal opaque build, or a
  `"#rrggbb"` string for a transparent build — see below. One field carries
  both the on/off toggle and the blend colour (plan Decision 4); no separate
  boolean.

## The frames store — content-addressed, swept (NOT permanent)

`Media/.gif-frames/<sha256>.png` (full frame) + `<sha256>.thumb.<w>.webp`
(strip thumbnail, 160px, MPI-769). Written once per unique content — a
reorder/drop/retime edit touches zero frame files, only the sidecar's `frames`
list.

**This is the opposite retention model from `Media/.preview-assets/`
(MPI-227).** That store is permanent forever; only the manual "Cleanup
assets…" command empties it, because a preview frame may be referenced by a
Reuse Prompt lineage nothing else tracks. GIF frames have no such lineage
concern — deleting the last card that used a frame should free it — so
`sweepGifFrames(mediaDir)` (`services/gifFrames.js`) runs it: reads EVERY
sidecar under `Media/.meta/` (archived groups included — archiving is a
`project.json` flag flip that never touches the sidecar file, `docs/gallery.md`
§ Retention), unions every `gif.frames[].hash`, and deletes any stored frame
not in that set. It never touches `.preview-assets`. Cheap no-op for a project
that never had a GIF (bails before listing a single sidecar).

**Sweep hooks (E4):** `DELETE /project-media/:projectId/:filename`,
`DELETE /delete-meta`, and after `POST /gif/entry` with `mode: 'update'`
(an update can drop frames the previous list referenced; `mode: 'new'` never
removes a reference, so it does not sweep).

## Build — two-pass palette, then patch every delay

`buildGif(entry, mediaDir, outAbsPath)` in `services/gifFrames.js`. **Why not
just ask ffmpeg for the delays directly:** ffmpeg's own demuxer duration
reporting drifts on a naive build — proven in
`.agents/mpi-kanban/tasks/MPI-757/research/2026-09-15-investigation.md`: asking
for delays `10,50,3,2,7` (hundredths) produced `12,48,4,1,7,4` — drift AND an
extra frame. The fix, reproduced again while writing this module:

1. Build at a **constant frame rate** (10 fps) via the concat demuxer, one GIF
   frame per list entry — uniform pacing, so ffmpeg cannot drift a duration.
2. **Patch every frame's Graphic Control Extension delay** (2 bytes LE) with a
   real GIF **block walker** — header, optional Global Color Table, then
   Extension/Image blocks to the trailer, following the format's own
   length-prefixed sub-blocks. A byte scan for `21 F9 04` is wrong: it
   false-matches inside LZW-compressed image data (the research file measured
   a bogus delay of 58178 that way).

Verified: the patched GIF reads back the exact requested delays through both
an independent block walk AND `sharp(path,{animated:true}).metadata()`
(`delay` in ms = hundredths x10).

**Transparent output.** When `output.edgeColour` is set, each frame is
pre-processed with `blendEdgeColour()`: the RGB is flattened toward
`edgeColour` wherever alpha is PARTIAL, while the ORIGINAL alpha channel is
left untouched (`flatten()` + `joinChannel()`, never `removeAlpha()` — see
`~/.claude/memory/tools/sharp.md`). ffmpeg's palette pipeline then reserves a
transparent palette entry (`reserve_transparent=1`) and `paletteuse`'s own
`alpha_threshold` (default 128) cuts each pixel's (untouched) alpha to fully
transparent or fully opaque. Skipping the pre-blend would hand back the
ORIGINAL colour a soft edge was hiding once its alpha crosses the threshold to
opaque — the exact trap in `~/.claude/memory/tools/image-alpha-flatten.md`
("flatten reveals, it does not fill"). Verified end to end: a fully
transparent source pixel survives as transparent, an opaque pixel is
untouched, and a half-alpha edge pixel comes back blended toward the edge
colour rather than showing its raw underlying colour.

A transparent build also passes `-gifflags -offsetting-transdiff` and patches
every frame's GCE disposal to 2 (restore to background). ffmpeg's defaults
write only each frame's changed pixels over a "do not dispose" frame, so a
transparent pixel shows the PREVIOUS frame through it: a moving cut-out
leaves its last pose behind.

**Opaque output** (`edgeColour: null`) flattens every frame onto black
(`OPAQUE_BACKGROUND`, the same default as GIF to Video) and passes
`reserve_transparent=0`. Leaving the alpha in made transparent pixels (Make
GIF padding) show the previous frame. It also made a list that mixed RGB and
RGBA PNGs lose a frame in the concat build. Pinned by
`tests/gif-frames.test.cjs` (transparent-pixels test) and
`tests/gif-make.test.cjs`.

**Never rebuild a `.gif` under the same URL (E5).** Chromium keeps decoded
image data per URL (`docs/gallery.md` § Retention), so `POST /gif/entry` with
`mode: 'update'` always mints a NEW sequenced filename via `nextSequence()`
and removes the old file once the new one lands — same id, new bytes, new URL.

## Extract — legacy lazy, new import eager

`extractFramesFromGif(gifAbsPath, mediaDir)`: `ffmpeg -fps_mode passthrough`
to one RGBA PNG per frame, delays and loop from
`sharp(path,{animated:true}).metadata()` (asserts frame count === `pages` or
throws loudly — a silent mismatch would misalign every delay after the gap).

- **New import** (`POST /project-media/:projectId/upload`, a `.gif` file):
  extracts EAGERLY, right after the upload lands. A failed extraction does not
  fail the import — the card still lands as a plain animated GIF, just without
  a frames store until the workspace opens it once.
- **Legacy `.gif`** (already on disk before this feature, or before MPI-768
  landed): nothing runs on project open. `POST /gif/ensure-frames` extracts
  the first time the workspace opens the card or a tool needs frames, then
  patches the sidecar so a reload never re-extracts.

## Routes (`routes/gif.js`)

- **`POST /gif/ensure-frames`** — `{ folderPath, itemId }` → `{ success, gif }`.
  No-op (besides URL mapping) if `gif.frames` already exists.
- **`POST /gif/entry`** — `{ folderPath, mode: 'update'|'new', itemId? (required
  for 'update'), frames: [{hash, delay}], loop, output, sourceItemId?,
  sourceGroupId? }`. `'update'` → `{ success, item }` (same id, new file).
  `'new'` → `{ success, item, group }` (precedent: `routes/videoReverse.js`).
  Validates every `hash` exists in the store before building (400 otherwise).

**Frame bytes are served through the existing generic `/project-file` route**
— the same one every `filePath`/`thumbPath`/`splatPath` already uses. There is
no second file-serving mechanism: both routes above resolve each frame's ready
`url`/`thumbUrl` in the response so a caller never has to know the
`.gif-frames` naming convention.

## Import hooks (`routes/projects.js`)

- **Upload** — eager extraction for a `.gif`, see above.
- **`add-from-cards`** — `copyGifFrames()` copies every referenced frame (+
  thumb) into the destination project's store before the cloned sidecar is
  written, same precedent as the existing `splatPath` copy in that route: a
  hash already present at the destination is left alone.

## What builds on this

MPI-769 (GIF history workspace) mounts the viewer/strip and calls
`POST /gif/entry`. MPI-770 (Make GIF) and MPI-760 (GIF Maker) get their OWN
route files (`routes/gifMake.js`, `routes/gifMaker.js`) that write frames via
`services/gifFrames.js` and then call `buildGif()` directly — they do not
route through `POST /gif/entry`. MPI-771 (cut-out) and MPI-772/773 (timing,
transform) all read/write the same `gif` field shape documented here.

# MPI-1073 - Video workspace: mask + Extract

**Fabio, 2026-10-11:** in the image AND video workspace, mask something (SAM3 by text, or
any mask) and press **Extract**: the masked area is kept, everything else removed, onto a
transparent background or a colour. The image half shipped as MPI-1072 (mask strip Extract
row, `POST /project/extract-media`, `docs/masking.md` § Extract). This card is the video half.

## What exists (read before designing)

- **The video workspace has NO mask tools.** `VIDEO_TOOLS` in
  `js/components/Compounds/MpiHistoryTools/MpiHistoryTools.js` = Prompt / Transform / Enhance
  / Export. So "in any mask mode" means building the video's first mask mode.
- **The engine half already exists and is reusable as-is:** `runGifCutoutTrack({ op, videoPath,
  textPrompt, objectIndices })` (`js/services/commandExecutor.js`). `op: 'gifCutoutSam3'`
  (SAM3 video tracker, by name) or `'gifCutoutBirefnet'` (remove background). Both graphs
  load the video with `MpiLoadVideoUpload`, `force_rate: 0` = EVERY native frame, and return
  ONE mask PNG per frame (`Output_Mask` /view URLs) in frame order; SAM3 also gives a
  numbered `Output_Preview` video. `max_objects: 4`. Both engines (local + remote) via
  `getEngine()`. Doc: `docs/masking-sam3-gif.md`.
- **Server mask fetch already exists:** `routes/gifCutout.js` exports
  `resolveMaskBufferInput(value)` (data: URL or http URL -> Buffer) and `applyMaskAlpha`.
- **A video ffmpeg op that lands a history entry:** `routes/videoReverse.js`
  (`POST /api/video/reverse`) is the template - trim in/out, probe, `nextSequence`, sidecar,
  `writeVideoDerivatives`, returns `{ item }`; the Block's `_handleReverseVideo()` appends it
  (`MpiGroupHistoryBlock.js`). Trim: `currentItem.trim` / `_activeVideoTrim()` - every video
  op honours the range.

## Proposed shape (my pick, not yet confirmed by Fabio)

1. **Rail:** a `Mask` group in `VIDEO_TOOLS` with one tool, **Extract** (`videoExtract`).
   Panel: method radio (Remove background / By name) + name field, background
   (Transparent / Colour + swatch), Extract button, Stop while running. No per-frame brush
   (the GIF workspace has one; a video brush is a much bigger job - follow-up if asked).
2. **Source for the tracker:** `POST /video-extract/source` - ffmpeg the trimmed range,
   DOWNSCALED to a long edge of ~1024 (all frames, source rate), into a temp file under
   `Media/.video-extract-tmp/` (self-swept like `.gif-cutout-tmp`). Why downscale: the
   loader holds every frame as float32 - 1080p x 121 frames ~ 3 GB, a 10 s 4K clip ~ 24 GB.
   SAM3 works at ~1008 px and BiRefNet at 1024 anyway.
3. **Apply:** `POST /video-extract/apply { sourcePath, trimIn/Out, masks[], background }` -
   fetch masks to a temp PNG sequence, then ffmpeg: the trimmed FULL-RES source + the mask
   sequence (`-framerate <fps>`), masks scaled to source size, `alphamerge`. Transparent ->
   **WebM VP9 `yuva420p`** (+ Opus audio); colour -> overlay on `color=` -> **MP4 H.264**
   (+ AAC). Keep source audio. Lands as a new history entry, operation `extract`.
4. **Verify the frame mapping** on a real clip: mask count == frame count of the trimmed
   source (seek-accurate trim on BOTH sides), and alpha on disk (`ffprobe` pix_fmt + a
   decoded frame's alpha at a corner).

## Open questions / risks

- **Does the app's video player show WebM alpha?** `docs/video-player.md` - mediabunny owns
  the paused frame, and the colour-matrix rule may flatten alpha. Check before promising
  "transparent" in the viewer; the file itself is fine either way.
- Do downstream video ops (upscale, interpolate, GIF Maker) accept a `.webm` source?
- `~/.claude/memory/tools/alpha-video-in-chromium.md` - alpha VP9 is NOT hardware-decoded;
  a straight-alpha resize leaves a pale rim (premultiply).

## Traps found in MPI-1072 (apply here)

- `tests/desktop/colour-pick-eyedropper.spec.js` mounts every tool panel against a PROXY
  viewer where every method exists, so `typeof viewer.el.x === 'function'` gates are always
  true there, and two radio buttons with the same `data-value` in one panel break its
  locators. Don't reuse `data-value="colour"` in a panel that has one.
- A Compound may not import a Compound (`--max-warnings=0` makes it red): `MpiColorField`
  (swatch + Pick) is a Compound, so mount it from the Organism panel, not a Compound.
- The pre-push done-gate wants a CI-green CODE commit before the close: push code, watch,
  then push the close as its own commit.
- `app:isolated` with a peer's uncommitted `dev_configs/node_lock.json` repairs the REAL
  engine: launch with scratch `CUBRIC_ENGINE_ROOT` / `CUBRIC_MODELS_ROOT` (no engine = no
  SAM3 though; a real track needs the user's engine or a seeded sandbox).

## Noticed

- Other video ops (upscale, interpolate, GIF Maker) read a transparent WebM with ffmpeg's native vp9 decoder, so the cut area arrives black there (docs/masking-video.md).
- Fabio 2026-10-11: a video track now follows every clip cut from it, but an image mask stays on its own entry (Extract does not carry it). He'd like the image workspace to match some day; not asked for now.

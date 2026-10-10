# MPI-1062 - Child-safety picture check for clips

## Why

Follow-up of MPI-1056 (child-safety gate, closed `eb05bb8bb`; read `docs/child-safety.md` first).
Fabio 2026-10-10: "remove clothes" on an imported photo must be looked at first, because the words
cannot know the age of someone in a picture from the internet. MPI-1056's picture check
(`js/data/childSafety.js` `needsPictureCheck` / `picturesOf` / `pictureCheck`, run in
`generationService.enqueueGeneration` `_judgeThenQueue`) looks at IMAGE mediaItems only, so the
same words on an imported VIDEO (Video Edit Flow, any v2v op) pass unlooked.

Fabio's steer: "every single video that lands in the app gets a first-frame thumbnail, so we can
use that."

## Who owns it

The MPI-1056 sessions (Fabio: "if you create that card, that card is your responsibility"; he no
longer reads the board). It is picked up from the MPI-1056 handoff, not from the board.

## What is known

- A video card's sidecar carries `thumbPath` (512 WebP) and `thumbPathLg` (1280 WebP) of the first
  frame, made by `services/ffmpegThumb.js` (`docs/gallery.md` § Video thumbnail pattern).
- "Cleanup assets..." deletes them and nulls the sidecar fields; they are rebuilt on the next
  project load (`/backfill-media-derivatives`). So a thumb can be missing for a while.
- An agent can hand a bare file path (MCP staging, MPI-873), which may have no sidecar yet.
- `js/utils/video.js` `firstFrameDataUrl(url)` grabs a first frame in the renderer;
  `flowEnhance.js` `stageFirstFrame` stages one into the project for the describer (Video Edit's
  describe step already does this).
- `llmService.describeImage({ imagePath, question })` reads an absolute path or a
  `/project-file?path=` URL, on both the ComfyUI and the Remote describer.

## Rules that stand (do not reopen)

- Text-only everywhere else; a picture is looked at ONLY when the words ask for nudity, underwear
  or sex (or are unreadable). No check on every run (tokens).
- Fail closed: no frame or no describer answer = refused.
- Perception, not age: a young-looking adult is refused too (Fabio accepted for this case).

## Noticed

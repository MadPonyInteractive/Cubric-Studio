# MPI-1073 plan - video Mask group, Text tool, Extract

Agreed with Fabio 2026-10-11: the video workspace gets a **Mask** group with ONE tool,
**Text** (SAM3 by name, the image Text tool's shape), and Extract is the last row of its
mask strip, exactly as in the image workspace. No Remove background method: mask + Extract
covers it, and the user picks what stays. No Add/Subtract: a track WRITES the mask (a
re-track replaces it).

## Steps
1. Server `routes/videoExtract.js`: `POST /video-extract/source` (trimmed, long edge <= 1024,
   h264, under `Media/.video-extract-tmp/`, self-swept) and `POST /video-extract/apply`
   (masks -> PNG sequence, ffmpeg alphamerge by frame INDEX; Transparent = WebM VP9
   yuva420p + Opus, RGB zeroed outside the mask so alpha-blind decoders (poster, proxy)
   show the subject on black; Colour = overlay on `color=` -> MP4 H.264 + AAC).
   Registered in `server.js`. -> verify: `tests/video-extract.test.cjs` (frame count,
   alpha at a corner, colour fill).
2. `MpiVideoViewer`: a CSS mask-image tint layer over the video's content box, per-frame
   from the mask list (luminance mask), plus the `MpiMaskStrip` surface
   (opacity, invert display, B/W, clear, extractMask -> emits `mask-extract`).
3. `MpiToolOptionsVideoMask` Organism: name + count (1-4), Detect/Stop, strip.
   Runner: `/video-extract/source` -> `runGifCutoutTrack({ op: 'gifCutoutSam3' })`.
4. Rail: `VIDEO_TOOLS` Mask group (`videoMaskText`); Block: registry, label,
   `mask-extract` -> `_handleVideoExtract` (lands entry like `_handleReverseVideo`).
5. Fix the shipped strip crash: Colour -> Transparent nulls `colourField` before `.el.remove()`.
6. Docs: `docs/masking-video.md` + pointer in `docs/masking.md` / `docs/README.md`.

## Verification
**Verify mode:** user-ux
- `node --test tests/video-extract.test.cjs`, lint on touched files.
- Eye-test in the app by Fabio: Text track on a clip, tint follows on play/scrub, Extract both ways.

## Current State
Built, committed, eye-tested by Fabio 2026-10-11 on a REAL SAM3 track ("Woman"): Transparent and
Colour Extract both land correct entries. Two follow-ups he asked for (do these next):
1. **The mask must survive.** After Extract the Block loads the new entry; `MpiVideoViewer.loadVideo`
   drops `_masks` on a src change, so going back to the source (or extracting again, e.g. Colour
   after Transparent) forces a fresh Detect. Stash masks per clip src (session, like the GIF
   viewer's signature stash) and restore on return; consider carrying them onto the extracted
   entry too (its frame 0 = the mask range's trimIn, so `trimIn: 0`, same urls).
2. **Eyedropper (Pick) on the Extract colour swatch**, image AND video. `MpiMaskStrip` is a Compound
   and cannot import `MpiColorField` (a Compound) - lint fails. Lift the Extract row out (or give
   the strip Pick another way); see the `ponytail:` note in MpiMaskStrip.js and
   `tests/desktop/colour-pick-eyedropper.spec.js` (counts colour controls per panel).
Then: CI green on the code commit, close as its own commit.

## Completed

## Plan Drift
- 2026-10-11: added the source-alpha ceiling (libvpx decoder on a vp9 source) - a second Extract of a
  transparent WebM came back black where the first cut was. Same route, one test.

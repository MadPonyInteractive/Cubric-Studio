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
Base built in 7ab93436d, eye-tested by Fabio 2026-10-11 on a real SAM3 track. His three follow-ups
are built (session "Mask extraction 3", uncommitted), automated checks green, waiting on his eye-test:
1. **Mask survives** - module-level stash by clip URL in MpiVideoViewer; Extract calls
   `carryMasksTo(newUrl)` (same urls, `trimIn: 0`). Spec `tests/desktop/video-mask-stash.spec.js`.
2. **Pick on the Extract swatch** - each mask panel passes `colourField: MpiColorField` to the strip
   (a Compound may not import it). Eyedropper spec gained a `maskextract` case.
3. **Export for editing** (Fabio's ProRes call) - Export group tool `exportEdit` ->
   `MpiToolOptionsVideoExport` -> `POST /video-extract/prores` (prores_ks 4444, yuva444p10le, PCM)
   -> `<a download>` Save dialog, never a card. Unit test in `tests/video-extract.test.cjs`.
Needs Fabio's app RESTARTED (new server route). Then: release-note line in UNRELEASED.md, commit,
CI green on the code commit, close as its own commit.

## Completed

## Plan Drift
- 2026-10-11: Fabio added a ProRes 4444 export for DaVinci (step 3 above) to this card.
- 2026-10-11: added the source-alpha ceiling (libvpx decoder on a vp9 source) - a second Extract of a
  transparent WebM came back black where the first cut was. Same route, one test.

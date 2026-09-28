# MPI-959 - Crop cuts the wrong region on EXIF-rotated photos

Found 2026-09-28 during MPI-949 Phase 5 (stack crop); Fabio asked for this card. Pre-existing:
single-card Crop has it too.

## The bug

The canvas (Chromium honours EXIF orientation) and `/image-import/probe` (`imageSize` swaps w/h for
orientation >= 5) both see a photo UPRIGHT. `cropExtended` (`services/imageCrop.js:78`) reads
`sharp(input).metadata()` width/height RAW and extracts from the RAW pixel grid, and sharp drops the
EXIF tag on output. So an upright-space rect is cut out of the sideways pixels and written sideways.

A phone photo shot portrait carries orientation 6 or 8. Imports under the reduce limit are copied
untouched (`mediaUploadService.js` only calls `/image-import/reduce` above `maxPixels`, which does
`autoOrient()`), so the EXIF tag survives into the project. Photographers are the core audience.

## Repro (Node, no app)

A 40x20 raw JPEG written with `withMetadata({ orientation: 6 })` (upright 20x40). `cropExtended` with
the upright rect `{ x: 0, y: 0, w: 20, h: 10 }` -> output differs from
`sharp(src).rotate().extract({ left: 0, top: 0, width: 20, height: 10 })` by up to 223 per channel.
Script used: a ramp image (`raw[i] = x * 6; raw[i+1] = y * 12`) so a wrong region cannot match by luck
- a solid half-and-half image DID match by luck on the first try.

## Same pattern elsewhere (check, do not assume)

`services/imageComposite.js` (`compositeThroughMask` :85, `compositeOverlay` :172 - Paint / Place /
Composite flatten) reads raw `metadata()` size and composites a canvas-drawn (upright) overlay onto
the raw base. Likely the same bug for Paint and Place on a rotated photo. Grep every `sharp(` consumer
that receives canvas coordinates or a canvas-sized overlay.

## Root-cause options (decide before coding - CLAUDE.md rule 4)

1. **Normalise at import:** bake orientation into the pixels when a file enters a project (the upload
   route already copies; auto-orient there). One place, and every downstream reader is right. Existing
   projects keep their rotated files, so it needs a migration or option 2 as well.
2. **Auto-orient in every server consumer** of canvas coordinates (`cropExtended`, `imageComposite`,
   ...): materialise `sharp(input).rotate()` (or `autoOrient()`) to a buffer FIRST, then plan from the
   upright size (sharp applies `extend` after `extract` whatever the call order - see the two-pass
   comment in `cropExtended`). Fixes old projects; one call per consumer.

Likely both: 2 is the correctness fix for every file already on disk, 1 stops new ones arriving.

**Decision (Fabio, 2026-09-28): do BOTH.** Rotate on import AND auto-orient in every server consumer.
Part of umbrella MPI-962 (Big photos).

## Why rotate-on-import alone "sometimes does not work" (Fabio's other app)

Fabio has shipped rotate-on-import elsewhere and users still had to rotate by hand. Check each of
these against real files before calling the fix done - they are the usual causes, not proven here:

- **The tag is right and says 1.** A camera held sideways with its orientation sensor off (or a
  scanner, or a screenshot) writes orientation 1 on pixels that ARE sideways. No EXIF fix can know;
  only the user can. That case needs the manual rotate, which exists: the Resize tool's `rotation`.
- **The tag is stale.** An editor rotated the pixels and kept the old tag, so honouring it rotates
  twice. Chromium and sharp then AGREE (both honour the tag), so the app is at least consistent.
- **Orientation lives somewhere sharp does not read as EXIF:** HEIC/HEIF `irot`/`imir` boxes, XMP
  `tiff:Orientation` only, a PNG/WebP `eXIf` chunk. Check what `sharp(...).metadata().orientation`
  returns for each, and what Chromium shows.
- **Import copies one file and something else reads another.** A proxy or thumbnail made BEFORE the
  rotate, or a `.meta` sidecar holding the pre-rotate `pixelDimensions`.

The Verify list gains: one real portrait phone JPEG, one HEIC, one PNG with `eXIf`, one stale-tag file.

## Verify

- Unit test from the repro (ramp + orientation 6 and 8): `cropExtended` output equals the upright
  crop; the same for the composite functions if they are in scope.
- Desktop: `crop-resize-output.spec.js` and `stack-crop.spec.js` stay green; add an orientation-6
  source to one crop spec.
- Fabio: crop a real portrait phone photo in single-card Crop and in a stack.

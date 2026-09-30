# MPI-998 Validation

## Built (2026-09-30, session 43678b37, phase 1 of MPI-1000)

- `MpiStepPlace.js`: two toggle buttons (horizontal, vertical; icons `flipX_stroke` /
  `flipY_stroke`) on the Place it step. The value carries `place.flipX` / `place.flipY`; a value
  saved before this reads as not flipped (`placeFlips`). One `flipObject` draws the mirror for the
  preview, the Auto stamp and the Manual copy. Flip first, rotate second.
- Auto: `composePlacedObject` mirrors the object before the rotated stamp.
- Manual: when flipped, `composePlacedObject` derives the object mirrored at its own frame and the
  existing `mediaRole` seam puts it over `image2`; unflipped Manual still derives nothing. Manual's
  canvas shows no object, so a note says "The model receives the object mirrored."
- Reuse restores the flip (seeded from the value). Placement has no undo stack by design (the
  stack lives in the cutout stage), so there is no undo entry to carry.
- History workspace place tool (`MpiToolOptionsPlace`): not given a flip (brief default).
- Docs: `types.js` MpiStepPlaceProps value + the place kind block; `flowsRegistry.js`
  object-stamp step comment.

## Evidence

- `node --test tests/object-stamp-flip.test.cjs`: 12 pass, 0 fail. Real `CompositeManager`,
  `ShapeManager` and `stepKinds.js` over a software 2D canvas; pixel asserts for flipX and flipY
  in Auto, flip-then-rotate at 90 degrees against an independent oracle, Manual's mirrored copy
  taken from the cutout's object, value round-trips JSON. Worker mutation checks: 3 of 3 caught.
- `npm test`: 2463 pass, 0 fail, 2 skipped. `npm run lint:components`: clean.

## Left: Fabio's look (needs a generation on the local engine)

1. Object Stamp, Auto: flip, Alt-rotate, Generate. The result is mirrored, same place and angle.
2. Manual: flip, Generate. The result is mirrored.
3. Reuse the result: the flip buttons come back pressed.

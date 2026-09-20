# MPI-844 — a GIF card's size label describes the frames, not the file

## What Fabio saw

Longest edge set to 1024, Apply, and the history card still read `1536×640 · 2.39:1`
(2026-09-20). Measured on his own disk, `Cubric Studio Mascots/Media`:

| Card | File on disk | Card label | sidecar `maxEdge` |
|---|---|---|---|
| gif_002 | 1536×640 | 1536×640 | 1536 (gif-maker, "no cap" preset) |
| gif_004 | 1536×640 | 1536×640 | 1536 |
| gif_007 | 1536×640 | 1536×640 | 1536 (gifCutout, inherited) |
| gif_008 | **1024×426** | 1536×640 ❌ | 1024 |
| gif_009 | **1024×426** | 1536×640 ❌ | 1024 |

`maxEdge` works. The three genuine 1536s are older entries built with no cap. The fault is
the LABEL: `gif_008` and `gif_009` are 1024×426 files advertising their frame store.

## Root cause

`MpiHistoryList._dimsLabel()` reads `item.pixelDimensions`. Every route that writes a GIF
card stamps that from the FRAME STORE, two lines after `buildGif()` wrote a file scaled by
`output.maxEdge`:

- `routes/gif.js:182` (update) and `:216` (new) — `frameDimensions(frames[0].hash)`
- `routes/gifCutout.js:383` — same
- `routes/gifMake.js:156` — `{targetW, targetH}`, the frame canvas it resized to
- `routes/gifTransform.js:220` (crop) and `:264` (resize) — pre-build targets, passed into
  `_writeNewGifCard` as a parameter

`routes/gifMaker.js:251` is the one that gets it right — `sharp(outputPath).metadata()`.
**That is the pattern**; the fix is to make it the only one.

## It is not only `maxEdge` — measured

`buildGif`'s scale filter uses `-2` on the free edge, which forces a divisible-by-2 result,
so the built file can differ from the frames even when nothing is capped:

| Frames | maxEdge | Built |
|---|---|---|
| 405×723 | 1024 | **406×723** |
| 64×96 | 1024 | 64×96 |
| 1536×640 | 1024 | **1024×426** |
| 1536×640 | 1536 | 1536×640 |
| 6×6 | 1024 | 6×6 |

So an odd frame edge already mislabels by one pixel with no cap in play. Even frames under
the cap are unaffected, which is why almost every existing test stays green.

## The fix

One helper in `services/gifFrames.js` — `builtGifDimensions(absPath)` — used at EVERY site
that writes a GIF card after a `buildGif()`, `gifMaker` included, so there is one definition
of "the size of a GIF card". `_writeNewGifCard` loses its `pixelDimensions` parameter and
measures instead, which fixes both of its callers at once.

`frameDimensions()` stays: it is still the right answer for anything describing the frame
canvas. Only the card label moves.

**Out of scope, deliberately:** `routes/gifToVideo.js:217` writes a VIDEO card from a real
encode and stamps the forced-even size it encoded — already honest, and it never calls
`buildGif`.

## Verification

**Verify mode:** auto

- `node --test tests/gif-frames.test.cjs tests/gif-transform.test.cjs tests/gif-cutout.test.cjs tests/gif-make.test.cjs tests/gif-maker.test.cjs tests/gif-timing.test.cjs tests/gif-preview.test.cjs`
- A new case proving the capped build: frames bigger than `maxEdge` must land the BUILT
  size on the card, not the frame size. Red on the old code by construction.
- `gif-transform.test.cjs:124` asserts `{w:405,h:723}` — the frame size. It becomes
  `{w:406,h:723}`, the real file. That is the behaviour change, not a broken test.
- Lint.

## Remaining Work

- [ ] `builtGifDimensions()` in `services/gifFrames.js`.
- [ ] Six call sites: `gif.js` ×2, `gifCutout.js`, `gifMake.js`, `gifTransform.js`
      (`_writeNewGifCard`), `gifMaker.js`.
- [ ] Tests: the new capped case + the 405×723 assertion.
- [ ] Docs: the `pixelDimensions` contract in `docs/gif.md`.

## Current State

Created 2026-09-20 out of MPI-838's user-ux check. Root cause traced and measured before any
edit; nothing implemented yet.

# MPI-871 - plan

## Current State

**Built and green; waiting on Fabio's eyes in the app (verify mode: user-ux).**

Fabio answered (a) on 2026-09-21: playback clamps to the trim and wraps to the in-handle.
The viewer now takes the range as a public input and the Block pushes it from the two
subscribers it already had. 20/20 desktop GIF specs pass, and each of the three behaviours
was proven RED by backing it out on its own (see `validation.md`).

**The single next action:** Fabio plays `gif_113` with the handles set and confirms the
playhead stays between them. Then the card closes.

**Two things a fresh session must not re-derive:**

1. `setFrameIndex` / `stepFrame` deliberately do NOT clamp to the range - see Plan Drift.
2. Option (b) was already shipped before this card started. The strip's dimming IS (b).

## Completed

1. Decide (a) or (b) - **(a)**, Fabio, 2026-09-21.
2. The range reached the viewer as `el.setRange(range|null)`, fed from
   `MpiGroupHistoryBlock`'s existing `range-change` / `range-preview` subscribers. The
   viewer never reads the trim itself; it mirrors, exactly as `MpiFrameStrip` does.
3. The index sites: the wrap in `_scheduleNext` ends on the out-handle and returns to the
   in-handle; `play()` rejoins at the in-handle when it starts outside; `_playsDone` counts
   passes of the RANGE; a handle moved under a playing head rejoins WITHOUT counting a pass.
4. `tests/desktop/gif-timing.spec.js` extended (not a new file) and proven red three ways.

## Remaining Work

- Fabio's live check on `gif_113`. Nothing else.

## Plan Drift

**2026-09-21 - step 3's "setFrameIndex / step respect the range" was wrong, and is not
built.** Fabio's own (a) says scrubbing and stepping outside the range stay allowed, and the
code agrees: `MpiGifControlBar.js:215-224` binds `video.trim.in` / `video.trim.out` to
`trim.setRange(cur, ...)` where `cur = _viewer.el.getFrameIndex()`. A head that cannot leave
the range would leave the range able only to SHRINK - I and O could never widen it again.
The clamp belongs to playback alone. `setFrameIndex` carries a comment saying why.

**2026-09-21 - step 4's "the range must survive a reorder / delete" dissolved; no code.**
The range is POSITIONAL, not frame-identity: `MpiFrameStrip.js:196` clamps its copy to the
last index and never remaps, so the handles stay where they sit on the timeline and the
viewer must agree with what the bar and the strip are drawing. `gifFrameMasks.js:78` is the
rebind precedent for MASKS, which ARE keyed by identity. Every read goes through
`rangeBounds(_frames.length, _range)`, so a shrunken list cannot dangle, and `loadFrames`
drops the range outright.

**2026-09-21 - one tier-rule exemption taken, and it is a real debt, not a false alarm.**
The viewer imports `rangeBounds` from `Organisms/MpiToolOptionsGifTiming/gifTiming.js`, and
`mpi/no-same-tier-component-import` forbids Organism -> Organism. `npm run lint` runs
`--max-warnings=0`, so it would red CI. `rangeBounds` cannot be lifted out alone (it needs
`clampInt` -> `clampNumber`, which five other exports in that file use), and duplicating it
in the viewer would create a second reading of the trim - the thing `gifTiming.js`'s own
header forbids. Taken: one `eslint-disable-next-line` with the reasoning inline.
**The real fix is moving `gifTiming.js` to `js/utils/`** - it is already a shared pure
module (`js/shell/gifJobs.js` imports it, and `tests/gif-timing.test.cjs` resolves it by
path). That is a 5-file change touching three files MPI-871 does not own, so it was flagged
to Fabio rather than done here.

## Verification

**Verify mode:** user-ux - the fix is what playback looks like, and step 1 was his call.

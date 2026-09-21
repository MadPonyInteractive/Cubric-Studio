# MPI-871 - checklist

- [x] Ask Fabio: playback clamps to the trim (a), or whole-clip with the outside dimmed (b)
      -> (a), 2026-09-21. Note (b) was ALREADY shipped - the strip dims the outside - and
      that is the state he reported as the bug.
- [x] Feed the resolved range into MpiGifViewer as a public input (`el.setRange`), pushed
      by the Block from the two range subscribers it already had
- [x] Wrap lands on the in-handle, not frame 0
- [x] Loop count counts passes of the RANGE
- [x] Desktop spec asserts the rendered index never leaves [in, out]
- [x] Playback rejoins the in-handle when it starts (or a handle moves) outside the range
- [~] Step / setFrameIndex respect the range - DELIBERATELY NOT DONE. The plan asked for
      it, Fabio's own (a) does not ("scrubbing/stepping outside it stays allowed"), and
      clamping would break the control bar: `video.trim.in` / `video.trim.out` set a
      handle from `getFrameIndex()`, so a head that cannot leave the range leaves the
      range able only to SHRINK. The clamp belongs to playback, and the comment on
      `setFrameIndex` now says so.
- [~] Range survives a reorder / delete - DISSOLVED, no code needed. The range is
      POSITIONAL, exactly as MpiFrameStrip's is (`MpiFrameStrip.js:196` clamps to `last`
      and never remaps by identity), so the handles stay where they sit on the timeline.
      Every read goes through `rangeBounds(_frames.length, _range)`, so a shrunken list
      cannot leave it dangling, and `loadFrames` drops it outright. `gifFrameMasks.js:78`
      is the precedent for MASKS, which are keyed by frame identity - the range is not.

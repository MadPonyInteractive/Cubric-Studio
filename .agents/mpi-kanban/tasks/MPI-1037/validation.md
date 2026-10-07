# MPI-1037 validation

**Cause.** `focusModeService._enterVideoFullscreenIfPresent` fullscreened "the first `<video>`
under `#tool-container`". On an image there is no clip, but the MPI-906 mascot peek
(`#mascot-peek`, a src-less `<video>` at opacity 0) lives in History's centre slot, so F
fullscreened it and the screen went black. Video worked only because its player is ahead of
the peek in the DOM.

**Fix.** `fdbad7e79` - the lookup names the History video viewer's player
(`.mpi-video-viewer__player video`). Images, with or without the inline compare, take the
chrome-hide CSS path.

**Evidence.** `tests/desktop/focus-mode.spec.js`, new test "F in History: ...":
- on the pre-fix code: red, `document.fullscreenElement` = `"mascot-peek"`, failure
  screenshot fully black (the reported bug);
- with the fix: 3/3 green locally. Asserts on screen pixels: the image is on screen after F,
  and with Compare on the base side shows red and the after side blue; a video group still
  fullscreens `mpi-video-surface__video`.

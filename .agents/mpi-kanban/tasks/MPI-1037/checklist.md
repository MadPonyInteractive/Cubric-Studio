# MPI-1037 checklist

- [x] Reproduce: image card in History, F -> black screen; confirm `document.fullscreenElement` is `#mascot-peek`
- [x] Fix `_enterVideoFullscreenIfPresent` to fullscreen only the video viewer's own player
- [x] Image + compare: F keeps the inline compare visible (chrome-hide path, canvas refits)
- [x] Video still goes native fullscreen on F
- [x] Regression spec in `tests/desktop/focus-mode.spec.js`

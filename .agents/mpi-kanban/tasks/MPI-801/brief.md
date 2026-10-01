# MPI-801 Brief

## Scope

1. History workspace Paint tools (Fabio 2026-09-17): hold Alt = colour picker over the canvas;
   click samples into `toolSettings.paint.color`; release returns to painting. Alt goes through
   `Hotkeys.bind` + `hotkeyRegistry.js`. Reuse `js/utils/colourKeyMask.js` `readImagePixels`.
2. Flows' paint step (Fabio 2026-10-01, screenshot of Scribble's "Draw it" step with the
   colour popover open and no picker): `MpiStepPaint` (step kind `paint`, Scribble and Draw It In)
   mounts a bare `MpiColorPicker` at `MpiStepPaint.js:533`. `MpiColorField`
   (`js/components/Compounds/MpiColorField/`) is that picker plus a Pick button on the native
   `EyeDropper` API, already used by five tool panels: swap it in, and add the same Alt-pick on
   the drawing canvas so a colour can come from the reference image under the strokes.

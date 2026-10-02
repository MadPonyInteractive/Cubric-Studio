# MPI-801 validation

## 2026-10-02 - Flow paint step Pick (2.0 scope)

- `MpiStepPaint` (Scribble, Draw It In) mounts `MpiColorField` instead of the bare
  `MpiColorPicker`: same `value` / `'change'` / `destroy`, plus Pick on the native EyeDropper.
- `tests/desktop/step-paint-pick.spec.js`: Pick mounted beside the swatch, a colour set through
  the field reaches the step's value and `onChange`. RED on HEAD (no colour field), green on the
  fix. `npm test` 2673 / 0 fail; eslint clean.
- Screenshot (throwaway spec, 800 px wide step): brush/eraser, Hard Round, swatch, PICK, UNDO,
  CLEAR on one row.
- Release note: the eyedropper bullet in `UNRELEASED.md` now names Scribble and Draw It In.

## Open

- Fabio's look in the app (his pre-cut smoke): Scribble, "Draw it" step, Pick samples a colour
  into the brush. Then CI green and the done move.
- Not in 2.0 unless Fabio adds it: hold-Alt pick (History Paint tools, Flow canvas).

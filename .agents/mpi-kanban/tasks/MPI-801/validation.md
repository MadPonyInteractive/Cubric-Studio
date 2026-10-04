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

## Fabio's look (2026-10-04, session 3b6b39a7) - PASSED

- Fabio, in his pre-cut smoke: "I had already checked the eyedropper", everything passes. CI
  `Tests` green on the code commit `df16648ad` (run 37007031522). The 2.0 half is DONE.

## Open (not 2.0)

- Hold-Alt pick on the History Paint tools and on the Flow canvas (`brief.md` scope 1 and the
  Alt half of scope 2), never built. Fabio 2026-10-04 wants 2.0 out rather than more added, so
  the card goes back to `todo` / `deferred` carrying only this half.

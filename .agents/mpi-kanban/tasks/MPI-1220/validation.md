# MPI-1220 validation

Root cause: both paint surfaces (`InputController` mousedown for the History/mask canvas,
`MpiStepPaint` mousedown for a Flow's paint step) call `preventDefault()` so a drag never
selects text. That also cancels the browser's default focus change, so a text box focused
before the press (Cosmo's chat, the step's prompt) stayed focused and the hotkey manager's
typing gate let B/E and other letters type into it.

Fix: each handler blurs `document.activeElement` right after its `preventDefault()`.

Evidence (2026-10-21):
- `tests/desktop/canvas-press-drops-text-focus.spec.js` focuses a textarea, presses each
  surface, asserts focus left it. Passes with the fix; FAILS with both blur lines disabled
  (`Expected: false, Received: true`).
- `tests/desktop/step-paint-pick.spec.js` still passes. ESLint clean on both files.

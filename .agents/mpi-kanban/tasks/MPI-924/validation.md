# MPI-924 validation

- `npx eslint MpiPromptBox.js types.js media-picker-to-history.spec.js` -> clean.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/media-picker-to-history.spec.js` -> 5/5 pass.
- The new gallery test bites: before the seat-at-creation fix it failed on
  `.mpi-prompt-box-media-strip__add` resolving to 0 elements. `_renderStrip([])` at mount
  compared 0 chips with 0 items, took the reorder fast path and returned before the
  append. History never hit it: its pinned entry chip always forces a full repaint.
- Screenshot from the spec run: `+` card at the strip head over the gallery box, a picked
  card staged as a chip, the op moved t2i -> i2i on its own. No "Add to history" toggle
  in the gallery picker (asserted).

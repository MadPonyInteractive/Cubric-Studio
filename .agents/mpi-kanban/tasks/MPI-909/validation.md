# MPI-909 validation

**Verify mode:** user-ux. Fabio checks the peek in the app, gallery and history, image and video models.

## Agent evidence (2026-09-26, session ab9e6fd6)

- `npx playwright test --config=playwright.desktop.config.js tests/desktop/prompt-box-peek.spec.js`
  -> 1 passed. Real gallery box: mount loads `vision/peek.webm` and does NOT play; `setModel(wan-22)`
  swaps to `video/peek.webm`, shows the ledge at `--peek-x` in 28-72%, hides it again on `ended`;
  no page errors.
- Framing screenshot (1280 wide, mid-peek): Reel's head sits on the box's top rule, cut at the
  bottom, clear of the `+` card on the left and the op strip on the right.
- `npx eslint js/components/Organisms/MpiPromptBox/MpiPromptBox.js` -> clean.

## Tunables, if Fabio wants them changed

- Return interval: 25-60 s (`_playPeek` / `_peekForModel`, MpiPromptBox.js).
- Zone: two bands either side of the lock button, 28-42% and 58-72% of the box width.
- Size: `--peek-w: 182px` (head ~52px), same as Cosmo's landing ledge.

## Fabio

Verified in the app 2026-09-26 ("1"). Closed.

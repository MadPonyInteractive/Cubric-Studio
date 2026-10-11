# MPI-1094 validation

## Agent evidence (2026-10-11)

- `node --test tests/image-sheet.test.cjs`: 8/8. Auto coverage > 97% on three mixed sets,
  Fabio's two portrait shots go side by side on 1:1, Bigger gets the biggest cell, 30
  pictures pack in < 500 ms, cells never overlap, `isValidTree` refuses bad trees, and a
  real-pixel render puts the framed half of a red/blue picture in its cell.
- `npm test`: 3131 pass, 2 fail. Both failures are a peer's uncommitted speech-to-text work
  (`transcribe` / `speechTranscribe` in `operationRegistry` / `commandRegistry`), not files
  this card touches.
- eslint clean on every changed JS file.
- Live, own `app:isolated` instance: two portrait test pictures selected, Combine opened the
  dialog, Auto packed them side by side uncropped (2048 x 1576), 1:1 cropped both centre,
  a drag reframed one and the wheel zoomed the other, Combine saved `sheet_001.png`
  2048 x 2048 matching the preview pixel for pixel, card at the gallery head.
- 16K, six 3000-6000 px pictures on 16:9: 16384 x 9216 in 1.4 s, 1.4 GB peak RSS.
- Packer reuse: `routes/ingredientsSheet.js` `layoutSheet` measured too slow with crops
  (9 pictures 67 s) and fixed to one canvas; same idea rewritten small in
  `js/utils/sheetLayout.js`. The LTX file (a peer's claim) is untouched.

## Remaining

- Fabio eye-test in the app: does framing feel right, is Bigger enough, are the shapes and
  sizes the right list.
- After that: one line in `docs/releases/UNRELEASED.md`.

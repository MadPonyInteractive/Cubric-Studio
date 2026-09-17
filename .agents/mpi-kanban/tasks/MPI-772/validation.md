# MPI-772 validation

Verify mode: `auto` (MPI-757 plan, Phase 4).

## 2026-09-17 - built and verified (session 9b06fc0e)

What landed: `MpiToolOptionsGifTiming` (one panel, five modes) + `gifTiming.js` (pure math);
rail groups Timing and Output in `MpiHistoryTools.js`; Block wiring (`_saveGifEntry` shared with
the strip pill, `_handleGifTimingApply`, registry, labels, trim range hook);
`MpiGifControlBar.getRange()` and a `range-change` on a frame-count reset; `docs/gif.md` section.

Checks, all run today:

- `node --test tests/gif-timing.test.cjs` -> 4/4 (16 fps -> 6, 0.33 -> 303, 50 -> 2, clamps; trim
  inclusive/either order; reverse keeps delays; loop/output return only their field).
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-timing.spec.js
  tests/desktop/gif-workspace.spec.js tests/desktop/gif-cutout.spec.js tests/desktop/history-modes.spec.js
  tests/desktop/gif-make.spec.js tests/desktop/gallery-gif-hover.spec.js --output=<scratchpad>` -> 11/11.
  gif-timing.spec: a real 6-frame RGBA GIF imported through the upload route, then Speed 16 ->
  sharp delay `[60 x6]`, loop 0, transparent column flattened black; Reverse -> hashes reversed,
  page 0 = last source colour; Loop 3 -> sharp loop 3; Trim 1..3 -> 3 pages, loop carried, note
  resets to "0 to 2 (3 of 3)"; GIF output 16 px / 16 colours / transparent -> 16x12, pixel (0,0)
  alpha 0, colour opaque, sidecar output `{16, 16, '#000000'}`; `Media/.gif-frames/` count unchanged.
- Bite: with the control bar's reset `emit('range-change')` removed, gif-timing.spec fails
  (`Keeps frames 1 to 3 (3 of 6)` stayed on screen). Restored.
- `npm run lint:components` clean; `node --test "tests/**/*.test.cjs"` -> 1273 tests, 0 fail.

Rail count assertions in `gif-workspace.spec.js` / `history-modes.spec.js` moved 1 -> 3.

## Left (blocked on peer claims, not on this card's logic)

- `js/components/types.js` typedef: MPI-532 and MPI-774 claim the file. Text: `types-hunk.md`.
- `js/shell/preloadStyles.js` line: MPI-774 claim 91f0ea6b (Phase 3d); message c772b0a1 asks it to
  add the line or release the file. The panel's `css:` list loads the stylesheet meanwhile.

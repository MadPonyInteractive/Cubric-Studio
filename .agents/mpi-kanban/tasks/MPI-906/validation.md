# MPI-906 Validation

Verify mode: user-ux. Fabio checks each spot live.

## Phase 1 - Generating card

2026-09-24 automated, PASSED:
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/gallery-generating-mascot.spec.js`
  (new: op key wins over type, getting-ready -> working on first preview, both srcs released on done).
- Same config, `gallery-media-release`, `gallery-gif-hover`, `gallery-renditions`: 11/11.
- `npx eslint MpiGalleryGrid.js`: clean.

Fabio's live check: VERIFIED 2026-09-25 ("1" - looks good, size included).

Phases 3-5 (session 667f09c0, 2026-09-25, under umbrella MPI-932): queued install, History peek,
starting-engine screen swap their PNGs for looping clips (`working` / `working` / `studio/engine-starting`),
each video mounted only while its spot shows and its src dropped on hide.
- `tests/desktop/waiting-spot-mascots.spec.js`: 3/3 PASSED (clip src, plays past 0.2s, gone on hide/destroy).
- Related: history-modes, flow-library-filters, flow-library-skips-drawer, engine-repair-reachable,
  media-picker-to-history, gallery-generating-mascot, cancelled-mascot, empty-state-mascots: 12/12 PASSED.
- eslint clean on the four changed .js files.
Fabio's live check: VERIFIED 2026-09-26 (screenshots of all three spots, "Everything else is fine"); his one ask,
  a bigger History peek, done: .mascot-peek 66px -> 120px; spec + history-modes re-run 4/4 PASSED.

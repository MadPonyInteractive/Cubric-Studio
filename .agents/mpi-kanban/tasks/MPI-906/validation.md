# MPI-906 Validation

Verify mode: user-ux. Fabio checks each spot live.

## Phase 1 - Generating card

2026-09-24 automated, PASSED:
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/gallery-generating-mascot.spec.js`
  (new: op key wins over type, getting-ready -> working on first preview, both srcs released on done).
- Same config, `gallery-media-release`, `gallery-gif-hover`, `gallery-renditions`: 11/11.
- `npx eslint MpiGalleryGrid.js`: clean.

Fabio's live check: VERIFIED 2026-09-25 ("1" - looks good, size included).

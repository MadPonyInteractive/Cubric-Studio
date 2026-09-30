# MPI-995 validation

## What changed

- `js/utils/uiZoom.js`: `ZOOM_DEFAULT = 0.9`. `normalizeZoomFactor` returns it for a missing,
  corrupt or out-of-range value (was 1.0); `restoreUiZoom` applies whenever the factor differs
  from the live one, so a first boot sets 0.9 and a stored 1.0 is left alone.
- `js/core/storage.js`: `getUiZoomFactor` defaults to `null` (never set) instead of `1`, so
  `uiZoom.js` owns the default. Its only caller is `uiZoom.js`.
- `styles/shell/landing.css`: `.mpi-landing__agent-slot` width `clamp(260px, 36%, 420px)` ->
  `clamp(260px, 42%, 480px)`.

Users who never pressed Ctrl+/- also open at 0.9 after updating; anyone with a stored size keeps it.

## Evidence

- `tests/ui-zoom-persist.test.cjs` 4/4, incl. the new "fresh install boots at 0.9; a stored 1.0
  is still honoured" (fails on the old code: storage default 1 skipped the apply). ESLint clean.
- One-off Electron run on a fresh profile (desktop `launchApp`, config extending
  `playwright.desktop.config.js` from the session scratchpad): `webFrame.getZoomFactor()` 0.9 with
  `mpi_ui_zoom_factor` unset. Landing slot at 1920x1032: 480 CSS px (cap), 130px clear of the
  headline; at 1280x800: 348px, ~27px clear. No overlap at either size.
- Fabio eye-checked the landing in his own app, 2026-09-30: "Looks absolutely fabulastic."

## Red master, and its fix

`773e4b9cf` turned master red (run 36687677346): every desktop spec boots a fresh profile, so
they ran at the new 0.9 default and seven pixel/height checks failed (agent-chat:653,
canvas-downscale-quality:72, control-heights:22, crop-resize-output:130, flow-audio-player:526,
fullscreen-titlebar:5, gif-workspace:258). `tests/desktop/shellWindow.js` now sets and stores
1.0 once the shell has booted, the way the port is pinned; the product default stays 0.9.
7/7 locally with the pin. Committed and pushed by a peer session as `4b4b8960b`.

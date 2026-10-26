# MPI-1296 validation

## What shipped

The minimised-app floating Latents window now fills each tile's footer with that run's
progress, behind the caption text, in Vision rose. Real percent only: a first cut swept
before the first percent, and Fabio asked for the sweep gone (2026-10-26) — he had seen
only the sweep because his running app predated the change (see Not checked).
The fill hides on Done and starts over from empty when the next queued item takes the tile.

- `js/shell/floatLatentBridge.js` — listens to the same id-tagged `tool:progress` the
  status bar uses, keeps the last value per gen even while the
  window is closed (so a tile opened mid-run starts at the real percent), forwards only
  whole-percent changes, seeds it in `openTiles()`, drops it on complete / cancel / error.
- `main.js` + `main/floatLatentWindow.cjs` — relay `float-latent:progress`.
- `main/float-latent.html` — `.cap` holds a `.fill` layer + `.txt` span; progress is
  owner-guarded by genId like every other per-tile message.

## Evidence

- `npx eslint` on the three JS files: clean.
- Playwright harness on the real `float-latent.html` with a stubbed ipcRenderer: 62% fill
  renders behind "Generating"; a tick from a previous gen id is ignored (fill stays 62);
  Done hides the fill; the next item's add-tile resets it to `--p: 0`; an empty footer
  before the first percent.
- `npm test`: 3684 pass, 0 fail (first cut).
- Fabio: the fill "looks good, exactly what I asked for" (harness look, 2026-10-26).

- Fabio, after a restart, one minimised run: "the footer follows the status bar" (2026-10-26).

## Note for whoever touches this next

The float window reloads its HTML each time it opens, but the feed lives in `main.js` + the
renderer bridge, which load only at app start — test changes here on a freshly started app.

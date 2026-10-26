# MPI-1296 validation

## What shipped

The minimised-app floating Latents window now fills each tile's footer with that run's
progress, behind the caption text, in Vision rose. Before the first real percent, and
while a node reports none (ESRGAN, MoGe, a Flow between passes), the band sweeps instead.
The fill hides on Done and starts over (sweeping) when the next queued item takes the tile.

- `js/shell/floatLatentBridge.js` — listens to the same id-tagged `tool:progress` /
  `tool:indeterminate` the status bar uses, keeps the last value per gen even while the
  window is closed (so a tile opened mid-run starts at the real percent), forwards only
  whole-percent changes, seeds it in `openTiles()`, drops it on complete / cancel / error.
- `main.js` + `main/floatLatentWindow.cjs` — relay `float-latent:progress`.
- `main/float-latent.html` — `.cap` holds a `.fill` layer + `.txt` span; progress is
  owner-guarded by genId like every other per-tile message.

## Evidence

- `npx eslint` on the three JS files: clean.
- Playwright harness on the real `float-latent.html` with a stubbed ipcRenderer: 62% fill
  renders behind "Generating"; a tick from a previous gen id is ignored (fill stays 62);
  Done hides the fill; the next item's add-tile resets it to `fill sweep`, `--p: 0`.
- `npm test`: see the commit.

## Not checked

Not watched end-to-end in a running app with a real generation minimised: Fabio's live
app was mid-render, and an isolated app would need a second GPU run beside it.

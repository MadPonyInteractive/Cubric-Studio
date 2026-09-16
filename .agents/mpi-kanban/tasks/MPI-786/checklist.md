# MPI-786 checklist

Found while building MPI-785 (commit e93bbf18): in `tests/desktop/gallery-filter-panel.spec.js`
a `POST /update-project` from `persistGroups()` sat pending 5-15 s after navigating from the
Projects landing to the gallery, with 15 landing preview `<video>`s still mounted behind it.

- [x] Reproduce in a real app instance (own Electron, own profile + port, empty engine root):
      first save queued ~14.9 s in 6 of 10 runs. Details in validation.md.
- [x] Root cause: landing only hidden; grid queue keeps loading clips; hidden paused
      `preload="auto"` clips hold range requests ~15 s; 3 EventSource streams + 3 clips = 6.
- [x] Fix at the root: `releaseProjectGrid()` on `_showShell()` (no timeout).
- [x] Re-measure in the real instance after the fix: 0 of 16 stalled.
- [x] Remove `SAVE_WAIT` + its comment from `tests/desktop/gallery-filter-panel.spec.js`; green 3 of 3.
- [x] Regression spec `tests/desktop/landing-grid-release.spec.js`, red on both mutations.
- [x] Docs: `docs/shell.md` § projectUI.js, `docs/testing-desktop-specs.md` new section.
- [x] `npm test` green; desktop suite 100/102, the 2 toast failures pre-exist (see validation.md).

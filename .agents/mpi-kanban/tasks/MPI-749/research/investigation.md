# MPI-749 investigation digest (2026-09-14)

Three read-only Haiku investigators (gallery grid internals, project-bar seam, popup/component infra),
then every load-bearing claim re-checked by hand. Line numbers are as of commit `1a63a66a`.

## Corrections to the investigator reports

| Report said | Actually |
|---|---|
| `MpiHistoryTools.js` not found | Exists; `MpiPopup` strip at ~416-440 is the hold-open / leave-countdown / Esc-while-open precedent |
| Recommended seam C: controls inside `MpiProjectName` | Rejected — a filter panel there means a Compound hosting a panel; see the seam decision in plan.md |
| Electron `^41.0.3` "maps to Chromium 131" | Wrong mapping, irrelevant conclusion stands: container queries are supported |
| The toolbar-size relayout is state-driven | Only the slider's input writes state; hotkeys drive the slider INSTANCE (`incrementSlider`) and `2170` recomputes on resize only — Phase 2 must add a `state:changed` relayout |

## Lint rule gap (spun off, not this card)

`.eslint-rules/no-same-tier-component-import.js` reports only when the import string contains
`/Compounds/` or `/Organisms/`. A sibling-relative import (`'../MpiContextMenu/MpiContextMenu.js'`)
never matches, so `MpiGalleryGrid.js:5-6` already imports two Compounds unreported. The plan honours
the tier rule's intent regardless.

## Seams evaluated

| Seam | Touches `MpiGalleryBlock.js` (MPI-623 claim) | Tier rule | Verdict |
|---|---|---|---|
| New `MpiGalleryToolbar` Compound, state-driven, mounted by `navigation.js` into a `MpiProjectName` slot | no | clean (Primitives only) | **chosen** |
| Grid mounts its own controls into the bar | no, but needs a cross-component DOM lookup | panel would be a Compound in a Compound | rejected |
| Shell-owned `#gallery-controls-mount` beside `#project-name-mount` | Block or grid must mount it | same problem | rejected — and the stats would end up LEFT of the controls, against the brief's order |
| Controls inside `MpiProjectName` | no | project bar must build a panel from Primitives and learn gallery semantics | rejected |

## Layout numbers (mockup, JetBrains Mono, real tokens)

Direction A with the stats readout hidden by a `@container (max-width: 1400px)` rule on the frame:

| width | stats | right clearance | left clearance ("test") |
|---|---|---|---|
| 950 | hidden | 29 | 244 |
| 1000 | hidden | 54 | 269 |
| 1300 | hidden | 204 | 419 |
| 1399 | hidden | 254 | 469 |
| 1440 | shown | 52 | 489 |
| 1600 | shown | 132 | 569 |

Long name "Cyberpunk lookbook client v2" at 950: truncated at 22ch, left clearance 38.
Direction A WITHOUT the fallback collided at 950 (234px overlap); B and C cleared (136 / 307).

## Other verified facts

- `.workspace-topbar` is `display:flex`, `#project-name-mount` `flex:1; min-width:0`, `.mpi-project-name` `width:100%` — container-type on it cannot collapse its width.
- `navigation.js` landing branch (`handleNavigation`, ~161-176) destroys the block and radial but never calls `_updateBreadcrumb`, so toolbar teardown needs its own call there.
- `Storage.getGalleryVolume` readers: `MpiGalleryGrid.js:459` and `MpiMediaPicker.js:482`.
- `MpiGalleryBlock.el.destroy` calls `grid.destroy?.()` (`MpiGalleryBlock.js:1887`).
- `tests/desktop/flows-tab-ring.spec.js:52` locates `.mpi-project-name__flows` and asserts it is a `<button>`.

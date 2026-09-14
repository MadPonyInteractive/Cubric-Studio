# MPI-749 Validation

## Phase 1: asset kinds, filter logic, card corner icon (verify: auto). PASSED 2026-09-14

**Unit + lint**

- `node --test tests/asset-kinds.test.cjs tests/gallery-filter.test.cjs` → 13/13 pass.
- `npm test` → 990/990 pass, 0 fail.
- `npm run lint` (`--max-warnings=0`) → clean.
- `renderIcon('filter','sm')` and `renderIcon('cube','sm')` → `<svg>` containing a `<path>`, each from
  its own `ICONS` entry (not the `info` fallback).

**Live DOM check.** Own instance `CUBRIC_E2E=1 npm run app:isolated` (port 54679, local engine gate
skipped per its log), Chromium via `playwright-cli -s=mpi749`, `MpiGalleryGrid` mounted standalone in
a 1600×900 host on real shipped media (`comfy_workflows/display/`).

Initial mount:

| card | selected item | `--kind` class | chip | data-kind | data-info |
|---|---|---|---|---|---|
| k-img | image | false | `display:none` | image | Image |
| k-vid | video | true | `flex`, 28×28, svg path | video | Video |
| k-scene | image + `splatPath` | true | `flex`, 28×28, svg path | scene | 3D Scene |
| k-aud | audio | false | `display:none` | audio | Audio |
| k-mix | video (history: video, image) | true | `flex`, 28×28, svg path | video | Video |
| k-prev | video, `stage:'preview'` | true | **`display:none`** under `--preview` | video | Video |

After `el.setGroups(...)` (the render-key path) and `el.markQueuedContinue('k-vid', true)`:

| card | change | `--kind` class | chip | data-kind |
|---|---|---|---|---|
| k-mix | `selectedIndex` 0 → 1 (the image item) | false | `display:none` | image |
| k-img | same item gains `splatPath`; type, index and file unchanged | true | `flex` | scene |
| k-vid | queued-continue | true | **`display:none`** under `--queued-continue` | video |

The k-img row is what proves the `_getGroupRenderKey` kind entry: nothing else in the key changed, so
without it the card would not have repainted.

Screenshots: [before](research/phase1-kind-chip-before.png) (camera chip on the video card, cube on
the 3D Scene card, none on image or audio) and [after](research/phase1-kind-chip-after.png) (cube on
the image card that gained a splat; none on the queued video card, whose CANCEL row owns the corner).
The mixed and preview cards sit below the host's fold, and the DOM tables cover them.

Not exercised live: the `--mascot-cooking` hide. It is the same selector shape as the two hides verified above.

## Phase 2: filter state, project-bar toolbar (verify: user-ux). Automated + live checks PASSED 2026-09-14, awaiting Fabio

**Unit + lint**

- `npm test` → 991/991 pass, 0 fail. `npm run lint` (`--max-warnings=0`) → clean.
- `rg -n "gallerySort\.filter|filter: 'all'|data-filter|mpi-gallery-grid__tab" js tests` → nothing in `js/`. At Phase 2
  the remaining hits were the Phase 3 specs (`gallery-archive.spec.js`, `media-picker-cards.spec.js`); Phase 3 migrated
  both. The same grep over `js` and `tests` now hits only `gallery-filter-panel.spec.js:115`, the new spec asserting
  that the `.mpi-gallery-grid__tabs` row is gone.

**Rig.** Own instance `CUBRIC_E2E=1 npm run app:isolated` (port 65013, `Local engine gate skipped — E2E profile`),
Chromium via `playwright-cli -s=mpi749p2`. In the page: `projectService.createProject('Cyberpunk lookbook client v2',
<session scratchpad>/probe-projects)` → `openProject({ folderPath })` → replace `state.currentProject` with six groups
on shipped `comfy_workflows/display/` media (2 images, one favourite; 2 videos, one favourite; an image item with
`splatPath`; a `stage:'preview'` image) → `navigate(PAGE_GALLERY)`. So the REAL project bar, navigation mount and
grid are under test, not a standalone mount. Console: one 404 from `validate-preview-assets` for the fake preview
item (fixture, not this change). Bar width = window − 32 in this rig.

**(a) Layout — zero overlap, stats cut measured.** Long name, truncated by the existing 240px cap.

| window | bar | name→centre | centre→toolbar | toolbar→stats | stats |
|---|---|---|---|---|---|
| 1920 | 1888 | 518 | 269 | 12 | shown |
| 1440 | 1408 | 278 | 29 | 12 | shown |
| 950 | 918 | 33 | 20 | — | hidden |

Sweep of the bar's own width, 1800 → 780 in 10px steps: with the stats FORCED visible, the first gap under 8px is at
bar **1360** (centre→toolbar 5px), so the `@container (max-width: 1400px)` cut stands (25px clearance at 1400). With
the real rule, centre→toolbar holds ≥ 20px at every width down to 780; the first gap under 8px is name→centre at bar
860 (≈ 892 window), below the 950 minimum.

**First pass FAILED (a), fixed:** without a cap the toolbar kept its 404px and ran under Flows + Record — centre→toolbar
0 at bar 1000, about −41 at 918 — because `__centre` is absolutely positioned and flex cannot see it. Fix:
`.mpi-project-name__toolbar { max-width: calc(50% - 7.25rem) }`; the table and sweep above are after it.

**(b) Panel behaviour** (real clicks and keys):

- FILTER click → one popup, `aria-expanded="true"`, rows `3D Scenes On · Videos On · Images On · Favourites Off · Previews Off`, order Newest.
- Row click (Images) → stays open, Images Off, 3 cards, dot on, tooltip `Filtered: 3D Scenes, Videos`.
- Pointer leave → open at 150 ms; re-entering at 150 ms held it past 450 ms; a second leave → open at 250 ms, closed at 370 ms.
- Outside click (project name) → closed.
- Esc after a mouse open → closed, focus on FILTER. Enter on FILTER → open, focus on the first row; Space toggled it
  (3D Scenes Off, 5 cards); Esc → closed, focus on FILTER.
- **Found and fixed during this check:** the first run left focus on `<body>` after Esc from a keyboard open. Root cause in plan.md § Plan Drift.

**(c) No overlay hold.** `Overlays.onDepthChange` subscribed across all of (b): zero depth events. Promoted hover videos: 2 before opening, 2 with the panel open.

**(d) Heat dot** (state written, grid + toolbar read back):

| `gallerySort` | dot | FILTER tooltip | cards | empty state |
|---|---|---|---|---|
| default | off | Filter and sort | 6 | — |
| `order:'oldest'` | off | Filter and sort | 6 | — |
| `hiddenKinds:['image']` | on | Filtered: 3D Scenes, Videos | 3 | — |
| `favourites` | on | Filtered: Favs | 2 | — |
| `previews` | on | Filtered: Previews | 1 | — |
| `favourites` + hide image, scene | on | Filtered: Videos · Favs | 1 | — |
| archived + hide video | on | Filtered: No types | 0 | Nothing archived in this filter |
| every kind hidden | on | Filtered: No types | 0 | No cards match (mascot) |

A real click on SHOW ALL from the last row → 6 cards, dot off.

**(e) Mount lifecycle.** At 950, five rounds of open panel → group-history → gallery: on history 0 toolbars, 0 popups,
slot empty, stats `flex` (`0 ENTRIES·0 KB`); back on the gallery exactly 1 toolbar, 0 popups, 1 slot child, stats hidden.
Landing: 0 toolbars, slot empty, 0 popups.

**Also:** hotkeys `-` `-` → level 3 → 1 with the slider at 1; `+` → 2; `i` → info on and the Info button active.
`state.galleryVolume = 0` → volume icon swapped, `Storage.getGalleryVolume()` 0, slider 0; back to 0.8 → Storage 0.8.

Screenshots: [1920](research/phase2-header-1920.png), [1440](research/phase2-header-1440.png),
[950](research/phase2-header-950.png), [panel open, filtered](research/phase2-panel-open.png),
[No cards match](research/phase2-no-cards-match.png), [950 after the nav loop](research/phase2-header-950-gallery-after-loop.png).

Not exercised live: the dev-only components view teardown (`_loadComponentsGallery`), and a real `.ply` scene.

## Phase 3: specs, docs, sign-off (verify: user-ux, final). PASSED 2026-09-14

**Fabio's sign-off, in his own app:** the filter panel; an empty gallery; projects with images and video, video
only, audio only; Esc closes the panel; mouse-out closes it at the right time — "more than verified". Kind-row
order: the mockup's (Images, Videos, Audio, 3D Scenes), now `panelOrder` / `PANEL_KINDS`. No components-page entry.

**Unit + lint:** `npm test` → 993/993 (two new: the panel order, and every kind row has both labels and an icon
that exists in `icons.js`). `npm run lint` → clean.

**Desktop:** `npm run test:desktop -- gallery-archive media-picker-cards flows-tab-ring gallery-filter-panel` →
first run 11 passed, 1 failed. The new spec's final `pageErrors` check caught one uncaught rejection whose value
was an `Event`. In-page capture named it: `MpiMaskedImagePreview`'s base `<img>` on the group-history page, loading
`/project-file?path=/comfy_workflows/display/flow-head-swap.webp` — the history workspace resolves an item's file
through `/project-file`, where the fixture's display-media path does not exist. Fixture fix, not a product change:
the group-history step opens a history-less group (the `flows-tab-ring.spec.js` precedent). Rerun of
`gallery-filter-panel` → 1 passed; the other three spec files were untouched after their passing run.

`gallery-filter-panel.spec.js` asserts: kind chips on video + 3D Scene cards only; the toolbar inside the project
bar and no grid tabs row; panel rows in panel order; hiding Images removes image cards (including the history-less
card, via the `{ type: group.type }` fallback), lights the dot, tooltip `Filtered: Videos, 3D Scenes`; Favourites
ANDs; pointer leave closes the panel and leaves no portal; `No cards match`, Esc, SHOW ALL restores every card;
stats shown at bar 1600, hidden at 918 with ≥ 8px gaps either side of Flows + Record; group-history has no toolbar
and keeps its readout at 918; back on the gallery exactly one toolbar; zero page errors across the run.

**Docs:** `docs/gallery-filters.md` (111 lines, new — the kind table, § Adding a media kind for MPI-759's GIF, the
filter contract, the toolbar seam), routed from `docs/README.md` (147) and `docs/data.md` § projectModel (93);
`docs/gallery.md` 199 → 197; `docs/component-contracts.md` 211 → 211 (two in-line heals of dead pointers).

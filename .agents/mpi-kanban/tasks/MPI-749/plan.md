# MPI-749 — Gallery kinds and filters

## Current State

**Where it stands (2026-09-14, session `73d72ea1`):** Phase 1 DONE, auto-verified ([validation.md](validation.md)).
Card in Doing. Next: Phase 2 via `mpi-continue` (user-ux, stops for Fabio). Fabio wants the card
driven phase by phase with a handoff after each phase verifies.

**Phase 1 facts Phase 2 builds on:**
- `js/utils/galleryFilter.js` exports `DEFAULT_GALLERY_SORT` (frozen, `hiddenKinds` too, so spread it),
  `matchesGallerySort`, `isGalleryFiltered`, `listedKinds`, and `describeGalleryFilter(sort, kinds = ASSET_KINDS)`.
  Pass the panel's `listedKinds(...)` result as `kinds` so the tooltip never names a kind the project has none of.
- `ASSET_KINDS` rows carry `label` (plural, panel rows) and `singular` (card chip `data-info`).
- The grid chip is `.mpi-group-card__kind`, driven by the card class `mpi-group-card--kind`; the render key carries `kindOfItem(sel).kind`.
- UI-only live checks: `CUBRIC_E2E=1 npm run app:isolated` skips the local engine gate, so no boot
  repair can touch the shared engine. Mount `MpiGalleryGrid` standalone via `playwright-cli -s=<name> eval`
  on `comfy_workflows/display/` media (recipe in validation.md § Phase 1).

**Project mode:** scalable-foundation — full guardrails, no prototype shortcuts.

**Design is settled.** Read [brief.md](brief.md) first; every decision in it was made by Fabio on
2026-09-14 and is not re-opened here. Mockups: [research/header-mockups.html](research/header-mockups.html)
(direction A chosen). Verified investigation: [research/investigation.md](research/investigation.md).

### Facts this plan stands on (verified against the code 2026-09-14)

- **Toolbar row** `.mpi-gallery-grid__tabs`: template `MpiGalleryGrid.js:154-181`; sort + filter
  tabs `2299-2356`; Archive toggle `2250-2271`; Info toggle `2273-2297` (+ `Hotkeys.bind('gallery.info.toggle')`
  `2290`); size slider `379-454` (`state.gallerySizeLevel`, Storage-mirrored at `state.js:104/256`;
  hotkeys `gallery.size.inc/dec` `452-453` drive the SLIDER instance via `incrementSlider`);
  volume slider `455-484` (grid-local `_volume` from `Storage.getGalleryVolume()`; `_applyVolume`;
  `MpiMediaPicker.js:482` also reads Storage).
- **Filter predicate** `_rerenderJustified` `1944-1961` — scope gate first (MPI-678), then a
  `filter` switch on **`group.type`**. Archive empty state `2037-2046` keys its copy off `filter === 'all'`.
- **Card** built in `_makeCard` `498-1799`, painted in `_render` (~`1231-1371`). `_getGroupRenderKey`
  `1854-1888` carries no kind. Bottom-right occupants: `__preview-actions` / `__queued-actions`
  full-width rows (CSS `906-1017`) and the cooking mascot (`--mascot-cooking`, CSS `472`).
- `splatPath` lives on **history items** (`projectModel.js:48/96`); `getSelectedItem` is `projectModel.js:204`.
- **`gallerySort` readers/writers:** `state.js:95`; grid `1944`, `2257`, `2267-2269`, `2320-2334`,
  `2350`; `tests/desktop/gallery-archive.spec.js:60,77,158`; `tests/desktop/media-picker-cards.spec.js:169`.
- **Project bar:** `MpiProjectName` is mounted ONCE, app-lifetime, in `js/shell.js:171` into
  `#project-name-mount` (`index.html:133`). Per-page state comes from `js/shell/navigation.js`
  `_updateBreadcrumb` `260-289` (gallery / group-history); the LANDING branch of `handleNavigation`
  (~`161-176`) never calls it. `.mpi-project-name` is `width:100%` inside a `flex:1` mount
  (`styles/shell/workspace.css:22`), so `container-type: inline-size` on it is safe. It imports only `MpiButton`.
- **`MpiPopup`** (Primitive) is the floating host: portals to body, anchors on `triggerEl`, flips and
  clamps, self-closes on `ui:close-all-popups`, cleans itself up when the anchor leaves the DOM, emits
  `mouseenter`/`mouseleave`, and **never touches `Overlays`** — so opening it does not trip the
  gallery's `'overlay'` media hold (docs/gallery.md § Media suspension).
- **Hold-open / leave-countdown / Esc-while-open precedent:** `MpiHistoryTools.js` ~`416-440` —
  `_strip.on('mouseenter', _clearStripTimer)`, `on('mouseleave', _armStripTimer)`,
  `Hotkeys.bind('historyTools.collapseStrip.close', …)` bound only while open (registry
  `js/managers/hotkeyRegistry.js:157`); the workspace Esc handler stands down while an
  `.mpi-popup.is-active` exists.
- **Row pattern:** `MpiReusePromptDialog.js:110-136` — `MpiButton` `icon:'circle'`, `iconActive:'check'`,
  `label`, `labelPosition:'right'`, `active`, `variant:'secondary'`, `toggle` event. `MpiRadioGroup` `size:'sm'` for a segmented choice.
- **Icons:** no `filter`, no `cube` in `js/utils/icons.js`.
- **Test commands:** `npm test` (= `node --test "tests/**/*.test.cjs"`; ESM utils load via
  `pathToFileURL` + dynamic `import`, see `tests/gallery-renditions.test.cjs:30-32`),
  `npm run test:desktop`, `npm run lint` (`--max-warnings=0`).

### Architecture decision — the toolbar seam (resolved from repo rules)

A new Compound **`MpiGalleryToolbar`**, composed from Primitives only (`MpiProgressBar` ×2,
`MpiButton`, `MpiPopup`, `MpiRadioGroup`), talking to the grid **only through state**
(`gallerySizeLevel`, new `galleryVolume`, `gallerySort`, `galleryShowInfo`). `MpiProjectName` exposes
an empty toolbar slot; `navigation.js` mounts the toolbar on `PAGE_GALLERY` and destroys it on every
other page.

Why this seam and no other:
1. `js/components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js` is claimed by **MPI-623** (parked in
   `doing`). This seam never touches it.
2. `.claude/rules/components.md` tier rule: a Compound may not import a Compound, so neither the grid
   nor `MpiProjectName` may host a filter Compound. (`mpi/no-same-tier-component-import` currently
   misses sibling-relative imports — the grid already slips through with `MpiContextMenu`/`MpiWaveform`.
   A separate session fixes the rule. **Do not lean on the loophole.**)
3. `.claude/rules/state.md`: every control already syncs through state except volume, which becomes a
   Storage-mirrored key exactly like `gallerySizeLevel`.

Rejected: the grid mounting its own controls into the bar (a DOM reach across components plus a
Compound import); controls built inside `MpiProjectName` (the project bar learns gallery semantics
and grows a panel).

**Ownership collision check:** no file this plan edits is in MPI-623's `files.json`. `projectModel.js`
(in that list) is only READ.

## Completed

- [x] Phase 1: asset kinds, filter logic, card corner icon (2026-09-14, auto-verified, validation.md).

## Remaining Work

## Phase 1: Asset kinds, filter logic, card corner icon

Verify mode for this phase: **auto**.

Ownership: `js/utils/assetKinds.js`, `js/utils/galleryFilter.js`, `js/utils/icons.js`,
`js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js`, `js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.css`,
`tests/asset-kinds.test.cjs`, `tests/gallery-filter.test.cjs`.

- [x] **`js/utils/assetKinds.js`** — `ASSET_KINDS` exactly as brief § 2, ordered, first match wins:
  `scene` (`!!item.splatPath`, `badge:true`, icon `cube`, label `3D Scenes`/`3D Scene`) → `video`
  (`badge:true`) → `audio` (`badge:false`) → `image` (catch-all, `badge:false`). Export
  `kindOfItem(item)` → the row. Takes the ITEM, never the group, and imports nothing that uses a
  browser-absolute path, so Node can load it. `tests/asset-kinds.test.cjs`: splat image → scene;
  video; audio; plain image, `null` and unknown type → image; badge flags per row. **Verify:** `npm test` green on the new file.
- [x] **`js/utils/galleryFilter.js`** — imports `assetKinds.js` only. `DEFAULT_GALLERY_SORT`
  `{ order:'newest', scope:'active', hiddenKinds:[], favourites:false, previews:false }`;
  `matchesGallerySort(group, item, sort)` — scope gate FIRST (`!!group.archived !== (sort.scope === 'archived')`
  → false; MPI-678 ordering), then `hiddenKinds` via `kindOfItem(item)`, then `favourites` (AND),
  then `previews` (AND, `item?.stage === 'preview'`); `isGalleryFiltered(sort)` (any hidden kind or
  either flag; `order` never counts); `describeGalleryFilter(sort)` → `Videos, 3D Scenes · Favs`;
  `listedKinds(entries, sort)` with `entries = [{ group, item }]` → kinds present in the CURRENT
  scope ∪ kinds in `hiddenKinds`, in table order. `tests/gallery-filter.test.cjs`: archived gate beats
  every filter; favourite videos; a hidden kind; Oldest filters nothing and is not "filtered"; a hidden
  kind with no cards is still listed; description text. **Verify:** `npm test` green on the new file.
- [x] **Icons** — add `filter` and `cube` to `js/utils/icons.js` (24-grid fill paths; the ones in
  `research/header-mockups.html` are acceptable). **Verify:** `renderIcon('filter','sm')` and
  `renderIcon('cube','sm')` return an `<svg>` containing a `<path>` (quick node or in-page check).
- [x] **Card corner icon** in `MpiGalleryGrid` — create one `.mpi-group-card__kind` chip in `_makeCard`;
  in `_render` set it from `kindOfItem(selected)`: shown only when `badge`, `renderIcon(kind.icon)`,
  `data-info` = singular label. Add the kind to `_getGroupRenderKey` or a `selectedIndex` switch
  will not repaint it. CSS: bottom-right, same chip treatment as `.mpi-group-card__overlay`
  (`--surface-bar` 58% + `--line-soft` border), persistent, independent of info mode; hidden under
  `--preview`, `--queued-continue` and `--mascot-cooking`. Do NOT refactor the four existing
  `isVideo` expressions — they answer "which media element to mount", a different question from kind.
  **Verify:** `npm test` and `npm run lint` green; in YOUR OWN `npm run app:isolated` instance (never
  `:3000` — read `docs/testing.md` and memory `tool_isolated_app_backgrounded_exits_zero` +
  `tool_sandbox_isolated_app_seed_uw_deps` first): a video card and a splat card show the chip, image
  and audio cards do not, switching a card's selected item from video to an image removes it, a
  preview-stage card shows no chip over Continue/Discard — screenshots + DOM readout in `validation.md`.

## Phase 2: Filter state and the toolbar in the project bar

Verify mode for this phase: **user-ux**.

Ownership: `js/state.js`, `js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js`,
`js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.css`, `js/components/Compounds/MpiGalleryToolbar/**`,
`js/components/Compounds/MpiProjectName/MpiProjectName.js`, `js/components/Compounds/MpiProjectName/MpiProjectName.css`,
`js/shell/navigation.js`, `js/managers/hotkeyRegistry.js`, `js/shell/preloadStyles.js`, `js/components/types.js`.

- [ ] **State** — `js/state.js`: `gallerySort` becomes `DEFAULT_GALLERY_SORT`'s shape (still NOT
  Storage-mirrored; keep the MPI-678 reason in the comment); add `galleryVolume: Storage.getGalleryVolume()`
  and mirror it in the Storage switch beside `gallerySizeLevel` (~`255`). `MpiMediaPicker` keeps reading
  Storage, which the mirror still writes. Replace top-level keys only.
- [ ] **Grid** — delete the `.mpi-gallery-grid__tabs` row, its CSS, and the sort/filter/archive/info/size/volume
  control mounts. Keep the three hotkeys, rewritten to write STATE (`incrementSlider` currently drives
  the slider instance, which no longer exists). Relayout on `state:changed` `gallerySizeLevel` (confirm
  no such listener exists today — `2170` recomputes only on resize); `_volume` follows `galleryVolume`
  and re-runs the existing `_applyVolume` sweep. Predicate → `matchesGallerySort(g, getSelectedItem(g), state.gallerySort)`.
  Archive empty-state copy → `isGalleryFiltered`. Add the "No cards match" empty state (small mascot,
  SHOW ALL resets to `{ ...DEFAULT_GALLERY_SORT, order, scope }`) shown ONLY when filtered and zero
  cards are visible — an unfiltered empty gallery stays blank, as docs/gallery.md deliberately keeps it.
  Reuse the `__scope-empty` structure.
- [ ] **`MpiGalleryToolbar`** — `js/components/Compounds/MpiGalleryToolbar/` (`.js`, `.css`, and a
  `filterPanel.js` parts file after the `MpiModelSettings/loraSlotParts.js` precedent). Primitives only.
  Size slider → `gallerySizeLevel`; volume slider → `galleryVolume` (volume icon swap as the grid did);
  FILTER `MpiButton` (`filter` icon + label, `--filtered` modifier draws the heat dot from
  `isGalleryFiltered`, `data-info` = `Filtered: …` or `Filter and sort`, `aria-expanded`); Archive and
  Info toggles with their tooltip copy moved VERBATIM from the grid. Every control reflects
  `state:changed`; unsubscribes stored; `el.destroy` defined.
  Panel: `MpiPopup` `position:'bottom'`, `triggerEl` = FILTER. Top bar: ALL / NONE (`MpiButton` ghost sm)
  + `MpiRadioGroup` sm Newest | Oldest. Kind rows from `listedKinds` (rebuilt on open and on
  `gallerySort` / `currentProject` change), divider `ONLY`, then Favourites / Previews. Row = the
  reuse-dialog `MpiButton` toggle at `size:'sm'` + kind icon + ON/OFF word; consumer CSS only SIZES
  Primitives. Behaviour: FILTER click toggles; row clicks never close; popup `mouseleave` arms a
  300 ms close, `mouseenter` clears it; outside click closes (FILTER itself excluded); keep a local
  open flag in sync with `MpiPopup`'s `close` emit; Esc via a NEW hotkey id `gallery.filter.close`
  in `hotkeyRegistry.js`, shaped like `historyTools.collapseStrip.close` and bound only while open;
  Enter/Space on FILTER opens and focuses the first row, Esc returns focus to FILTER. Motion
  `var(--t-fast)` `var(--ease)` opacity + 4px, none under `prefers-reduced-motion`. **Never call
  `Overlays`.** Register the CSS in `js/shell/preloadStyles.js`; document props/emits in
  `js/components/types.js`. **Ask Fabio** before adding it to `js/pages/components.js`.
- [ ] **Project bar** — `MpiProjectName` gets an empty `.mpi-project-name__toolbar` placed before
  `__stats` and `el.getToolbarSlot()`. `.mpi-project-name { container-type: inline-size }` and one
  `@container (max-width: …)` rule hiding `__stats` only when the slot is non-empty
  (`__toolbar:not(:empty) ~ __stats`), so group-history keeps its ENTRIES readout. The project name
  truncates with an ellipsis. Measure the real cut-off live: the mockup put the stats-visible collision
  at ≈1390px and the cut at 1400px; pick the smallest width where centre, toolbar and stats never
  overlap with a long project name, and record the numbers.
- [ ] **Navigation** — `_syncGalleryToolbar(page)` in `js/shell/navigation.js`, mirroring `_syncRadial`:
  on `PAGE_GALLERY` mount into `_projectNameInst.el.getToolbarSlot()` idempotently (a project switch
  must not double-mount); on `PAGE_GROUP_HISTORY`, `PAGE_LANDING` and the components view destroy it
  and empty the slot. Call it from `_updateBreadcrumb` AND the landing branch of `handleNavigation`.

**Verify (whole phase):** `npm test` and `npm run lint` green;
`rg -n "gallerySort\.filter|filter: 'all'|data-filter|mpi-gallery-grid__tab" js tests` returns nothing;
in your own `app:isolated` instance, record in `validation.md`:
(a) at 1920 / 1440 / 950 window widths a scripted bounding-rect check (same maths as the mockup)
shows zero overlap, stats hidden only below the measured cut and never on group-history;
(b) the panel stays open across row clicks, closes 300 ms after leave, on outside click and on Esc;
(c) the grid's media holds do NOT gain `'overlay'` while the panel is open;
(d) the dot is on for a hidden kind, Favourites or Previews, and off for Oldest;
(e) the toolbar is absent on group-history and landing, and gallery → history → gallery ×5 leaves
exactly one toolbar and one popup portal in the DOM.
Then STOP for Fabio (user-ux).

## Phase 3: Specs, docs, sign-off

Verify mode for this phase: **user-ux** (final).

Ownership: `tests/desktop/gallery-archive.spec.js`, `tests/desktop/media-picker-cards.spec.js`,
`tests/desktop/gallery-filter-panel.spec.js`, `docs/gallery.md`, `docs/component-contracts.md`, `docs/data.md`.

- [ ] **Specs** — move `gallery-archive.spec.js` (`60,77,158`) and `media-picker-cards.spec.js` (`169`) to
  the new `gallerySort` shape; "Images inside the archive" stays asserted, now via `hiddenKinds`.
  `flows-tab-ring.spec.js` must stay green untouched (it drives the project bar). New
  `gallery-filter-panel.spec.js`: chip on a video card and not on an image card; hiding Images removes
  image cards and lights the dot; Favourites-only; open, leave, auto-close; toolbar gone on
  group-history; stats hidden at 950. Fixture uses REAL shipped media (`comfy_workflows/display/`) —
  a made-up src 404s into the missing-media path (docs/gallery.md).
- [ ] **Docs** (each ≤200 lines) — `docs/gallery.md`: rewrite "Archive is a SCOPE, not a seventh
  filter chip" for the panel (scope is still the first gate), update "Record lives in the project bar"
  for the toolbar beside the centre group, add "Asset kinds and the filter panel" (the table, the
  selected-item rule, the listed-kinds rule, the toolbar seam and why, the stats cut-off);
  `docs/component-contracts.md`: `MpiGalleryToolbar` and `MpiProjectName.getToolbarSlot`;
  `docs/data.md`: `gallerySort` shape and `galleryVolume`.

**Verify:** `npm test`, `npm run lint`, and
`npm run test:desktop -- gallery-archive media-picker-cards flows-tab-ring gallery-filter-panel`
all pass (counts pasted into `validation.md`); `wc -l` on the three docs ≤200. Then Fabio judges the
chip, the panel's feel and the header at his own window sizes in his own app.

## Why there is no `## Parallel Batch`

Phase 2 is one contract spread over five files: the toolbar writes the `gallerySort` shape the grid
predicate reads, and the toolbar can only be verified mounted in the project bar through navigation.
Split across workers, no task would have a batch-safe `**Verify:**` of its own. Phase 1 has no
dependencies but is one small session, and Phase 2 needs its utilities. `mpi-execute-parallel` is not
appropriate for this card; run it through `mpi-continue`.

## Plan Drift

- 2026-09-14 (Phase 1): **row ORDER vs the brief's tooltip example.** `ASSET_KINDS` is precedence-ordered
  (scene → video → audio → image, the catch-all last), and `listedKinds` / `describeGalleryFilter` follow
  table order. So the tooltip reads `3D Scenes, Videos · Favs`, not the brief's `Videos, 3D Scenes · Favs`,
  and Phase 2's panel would list 3D Scenes ABOVE Images (the mockup shows Images, Videos, Audio, 3D Scenes).
  Put it to Fabio at the Phase 2 check. If he wants the mockup's order, it is a one-line display sort in the panel.
- 2026-09-14 (Phase 1): `describeGalleryFilter` gained an optional `kinds` argument (default: the whole table)
  so the toolbar tooltip can name only the listed kinds.
- 2026-09-14 (Phase 1): the chip also trims `.mpi-group-card__overlay` max-width on `--kind` cards so a long
  name clears it. MPI-751 held a live write claim on `MpiGalleryGrid.js` at session start; it released
  (commits `5a51434c`, `8c77f3aa`) before the grid edit, so no message was needed.

## Verification

**Verify mode:** user-ux

Phase 1 is `auto`; Phases 2 and 3 are `user-ux` — `mpi-continue` stops for Fabio after each.

Done means all of:
- Video and 3D Scene cards carry the corner icon; image and audio cards do not; the icon follows the selected item.
- The second toolbar row is gone; size, volume, FILTER, Archive and Info sit in the project bar on the gallery page only.
- The panel filters by kind (only kinds present, or hidden), Favourites and Previews, sorts Newest/Oldest, and behaves per brief § 5.
- The heat dot is on exactly when something is hidden.
- Nothing overlaps from 950px up; the stats readout drops only below the measured cut and never on group-history.
- `npm test`, `npm run lint` and the named desktop specs pass; docs updated; Fabio signs off in his own app.

## Preservation Notes

- **Rule files:** the component maps (`.claude/rules/component-mounts.md`, `component-events*.md`,
  `component-state.md`) will be stale — new Compound, new state key, a navigation-owned mount. At
  close-out ASK "Should I update `.claude/rules/`?" and use `mpic-update-component-map`; never edit
  a rule file without permission (CLAUDE.md rule 5).
- **Dev components gallery:** ask before adding `MpiGalleryToolbar`.
- **MPI-623** (parked in `doing`) owns `MpiGalleryBlock.js`. If any step seems to need it, `mpi-message`
  the owner and stop that line of work.
- **Spun off 2026-09-14, not this card:** the history-workspace `0 ENTRIES · 0 KB` bug, and the
  same-tier lint loophole. Do not fold either in.
- `docs/agent/gallery.md` (untracked in the tree) belongs to another session — never stage it.
- Commit by explicit pathspec only (`.claude/rules/git.md`); the card folder's `research/` goes with the card.

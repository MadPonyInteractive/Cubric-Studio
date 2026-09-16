# Gallery kinds, the FILTER panel and the gallery toolbar

MPI-749. What a gallery card IS (its **kind**), how the gallery filters and sorts, and the
toolbar in the project bar that drives both. Archive as a scope lives in
[gallery.md](gallery.md) § Archive. Verify a named file/function still exists before relying
on an entry.

## One table: `ASSET_KINDS` (`js/utils/assetKinds.js`)

| field | what reads it |
|---|---|
| `kind` | the id stored in `gallerySort.hiddenKinds` |
| `match(item)` | `kindOfItem(item)` — the card chip, the filter predicate, the panel's listed rows |
| `label` / `singular` | the panel row (`Videos`) / the card chip's `data-info` (`Video`) |
| `icon` | a key in `js/utils/icons.js`; the chip and the panel row both render it |
| `badge` | `true` = the card shows the bottom-right kind chip |
| `panelOrder` | the order the panel lists rows and the tooltip names them (`PANEL_KINDS`) |

- **Row order is match precedence, and the first match wins.** A kind that is a special case
  of another sits ABOVE it: a 3D Scene is an image item carrying `splatPath`, so `scene` is
  above `image`, and `image` is the catch-all that stays last (a test pins it). **Display
  order is `panelOrder`, never row order** — Images, Videos, Audio, 3D Scenes (Fabio's mockup).
- **Kind is read off the card's SELECTED history item, never `group.type`.** A video group
  can hold an image take; the chip must match what the card paints, and the filter makes the
  same call so the two cannot disagree. A generating placeholder has no item yet, so the grid
  and the panel pass `{ type: group.type }` in its place.
- `badge: false` means the card already reads as itself: unmarked is a picture, and an audio
  card's waveform says audio.
- `MpiMediaPicker` does NOT read this table: its type tabs still filter by `group.type`
  (`tests/desktop/media-picker-cards.spec.js` pins that divergence).

## Adding a media kind (GIF, MIDI, stems, characters…)

**A new kind is one row, and the gallery picks it up everywhere** — the card chip, the panel
row, the tooltip text and the grid predicate. `hiddenKinds` is an EXCLUSION list, so a new
kind is visible by default. Skip the row and nothing errors: the item silently lands on
`image`, with no chip and no filter row of its own.

1. **Decide the data first.** Prefer a sub-kind matched off the item over a new media `type`:
   a new `type` reaches every `type === 'image'` / `'video'` branch in `js/` and `routes/`.
   The 3D Scene (`splatPath`) is the precedent; MPI-759 added GIF the same way
   (`type: 'image'`, matched by a truthy `gif` field or a legacy `.gif` filename —
   see [gallery.md](gallery.md) § GIF cards for how the card then paints it).
2. **Add the row** to `ASSET_KINDS`, ABOVE any row it would otherwise fall into (a GIF that is
   `type: 'image'` goes above `image`), with `label`, `singular`, `badge`, and a `panelOrder`
   where it should list (renumber the others if it goes in between).
3. **Add its icon** to `js/utils/icons.js`, a 24-unit fill path like its neighbours.
   `renderIcon` falls back silently on a missing key; `tests/asset-kinds.test.cjs` fails instead.
4. **Update the tests.** `tests/asset-kinds.test.cjs`: the match, the precedence case, the
   panel order and the badge list. `tests/gallery-filter.test.cjs` only if listing or the
   tooltip text changes.
5. **What the row does NOT do:** how the card PAINTS the item (the grid's `isVideo`
   expressions decide which media element mounts — a different question from kind), hover
   playback, the history workspace, and the media picker. Those are the new kind's own work.

## The filter contract: `gallerySort` (`js/utils/galleryFilter.js`)

`state.gallerySort = { order, scope, hiddenKinds, favourites, previews }`, starting from the
frozen `DEFAULT_GALLERY_SORT` (spread it — its array is frozen too). In-memory by design: a
launch never opens into a filtered-looking gallery (MPI-678). Replace the top-level key, never
mutate it.

- `matchesGallerySort(group, item, sort)` is the grid's only predicate: **scope first**
  (subtractive), then `hiddenKinds` via `kindOfItem(item)`, then the `favourites` and
  `previews` "only" flags, ANDed. `order` hides nothing.
- `isGalleryFiltered(sort)` — any hidden kind or flag. It drives the FILTER heat dot and the
  empty states; Oldest does not count.
- `listedKinds(entries, sort)` — the panel's rows: kinds with a card in the CURRENT scope,
  plus every hidden kind (so a hidden kind can always be switched back on), in panel order.
  NONE hides the listed kinds only.
- `describeGalleryFilter(sort, listed)` — `Videos, 3D Scenes · Favs`, shown as `Filtered: …`.
  Pass the listed kinds, or it names kinds the project has no cards of.

Empty states: the archive says `Nothing archived` (`… in this filter` when filtered). A
filtered active gallery showing nothing gets the mascot, `No cards match` and SHOW ALL, which
resets kinds and flags but keeps `order` and `scope`. An unfiltered empty gallery stays blank.

## The gallery toolbar: `MpiGalleryToolbar` in the project bar

Size slider, volume slider, FILTER, Archive, Info. It replaced the grid's second row
(`.mpi-gallery-grid__tabs`, gone).

- **The seam.** A Compound built from Primitives that talks to the grid ONLY through state:
  `gallerySizeLevel`, `galleryVolume` (Storage-mirrored), `gallerySort`, `galleryShowInfo`.
  The grid keeps the `+` / `-` / `I` hotkeys, which write the same keys.
  `js/shell/navigation.js` `_syncGalleryToolbar` mounts it into
  `MpiProjectName.el.getToolbarSlot()` on the gallery page and destroys it on every other page,
  idempotently. Why here: a Compound may not import a Compound, so neither the grid nor the bar
  can host it, and `MpiGalleryBlock` was claimed by MPI-623.
- **The panel** (`filterPanel.js`) is an `MpiPopup` CREATED on open and REMOVED on close, so
  the DOM holds zero or one. It never calls `Overlays`: an overlay puts the grid's media on its
  `'overlay'` hold ([gallery.md](gallery.md) § Media suspension). It closes 300 ms after the
  pointer leaves it (re-entering cancels), on an outside pointerdown, and on
  `ui:close-all-popups`. Row clicks keep it open.
- **Escape needs no hotkey of its own, and one would never fire.** Handlers for one key share
  a single insertion-ordered Set; `overlay.close` (bound in `overlayManager.js`'s constructor)
  always runs first and, with no overlay open, emits `ui:close-all-popups` — which closes the
  panel and unbinds anything it had bound before the Set reaches it. So `close()` hands focus
  back to FILTER whenever focus was inside, whichever path closed it; removing the focused row
  would otherwise drop focus to `<body>`.
- **Layout.** `.mpi-project-name` is a size container. The stats readout hides at a BAR width
  ≤ 1400px, and only while the slot holds a toolbar, so group-history keeps its ENTRIES readout;
  the stats-visible collision measured at 1360. The slot's `max-width: calc(50% - 7.25rem)`
  reserves the absolutely positioned Flows + Record group, which flex cannot see. **Re-measure
  both numbers when the centre group or the toolbar gains a control** — the bar-width sweep is
  in MPI-749's `validation.md` § Phase 2.

## Tests

- `tests/asset-kinds.test.cjs`, `tests/gallery-filter.test.cjs` — the table and the contract (Node).
- `tests/desktop/gallery-filter-panel.spec.js` — chips, panel, dot, SHOW ALL, group-history, the stats cut-off.
- `tests/desktop/gallery-archive.spec.js` — the scope gates before the kinds.

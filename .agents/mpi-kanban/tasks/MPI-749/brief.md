# MPI-749 Brief — Gallery kinds and filters

Approved design brief from the 2026-09-14 brainstorm (mpi-brainstorm + impeccable shape).
Every decision below was made by Fabio in that session; the plan implements it, it does not
re-open it. Live mockups: [research/header-mockups.html](research/header-mockups.html)
(direction A is the chosen one; B and C are kept as the rejected alternatives).

## 1. What it is

Gallery cards get a corner icon when they are more than a plain picture. The six filter chips
and the whole second toolbar row (`.mpi-gallery-grid__tabs`) are replaced by one FILTER button
that opens a small panel. The remaining gallery controls move up into the project bar.

Why now: video vs image is already hard to tell apart, and new asset kinds are coming —
3D Scene (MPI-623, an image item carrying `splatPath`), characters (image + text), MIDI,
audio stems. Each would add another chip to a toolbar that already overflows (MPI-678).

## 2. Decisions (with the reason)

| Decision | Reason |
|---|---|
| One ordered `ASSET_KINDS` table, first match wins: `{ kind, label, icon, badge, match(item) }` | Adding a kind later = one row; card icon and filter row both appear from it |
| Rows today: `scene` (`!!item.splatPath`, badge) → `video` (badge) → `audio` (no badge) → `image` (catch-all, no badge) | Scene is deliberately NOT a 4th media type (projectModel.js, MPI-623), so `type` alone labels it "image" |
| Kind is read from the card's **selected history item**, not `group.type` | A video group can hold an image item; icon must match what the card paints. Filter uses the same function so icon and filter never disagree |
| Badge only on kinds that are not a plain image and not plain audio | Unmarked = "just a picture". Audio's waveform already says audio. Stems-bundled audio later = its own row with `badge:true` |
| Filter panel reuses the Reuse Prompt row pattern, smaller | Fabio's reference UI |
| Types are multi-toggle (OR), all ON by default; Favourites / Previews are "only" flags (AND on top) | Makes "favourite videos" possible, which a single-select string cannot |
| A type row is listed only if the project has a card of that kind OR the kind is currently hidden | No dead "3D Scenes"/"MIDI" rows; a hidden kind can always be switched back on |
| State: `gallerySort = { order, scope, hiddenKinds: [], favourites, previews }`, still in-memory | `hiddenKinds` (exclusion) means a new kind shows by default; in-memory per MPI-678 (never relaunch into a filtered-looking gallery) |
| Persistent filtered indicator: heat dot on FILTER | Matches the header's own "active = heat dot" tag rule (DESIGN.md § Tags). Filters behind a button must never read as missing assets |
| Sort (Newest/Oldest) lives in the panel's top bar, where Reuse Prompt has Original/Current | Header decluttered; sort changes rarely. Oldest does NOT light the dot (it hides nothing) |
| Archive stays its own header toggle | MPI-678: archive is a scope, and you must see when you are in it |
| Header direction **A — one row** | Gets a full row of gallery height back |
| Narrow fallback: drop the `N ASSETS · SIZE` readout | Fabio: the landing page already shows per-project size. Measured fits (below) |

## 3. Layout

Header, gallery page, one row:

`← PROJECTS name` │ `FLOWS  RECORD` (absolutely centred, unchanged) │ size slider · volume slider │ FILTER• · Archive · Info │ `—— N ASSETS · SIZE`

- `.mpi-gallery-grid__tabs` row is deleted.
- On the History page the gallery controls are hidden, same gate as Record (`setRecordVisible` in `_updateBreadcrumb`, js/shell/navigation.js).
- Long project names truncate with an ellipsis.

Measured in the mockup (JetBrains Mono, real tokens; re-measure in the app, fonts differ slightly):

| window | stats | clearance right of Flows/Record |
|---|---|---|
| 950 (min, main.js) | hidden | 29px |
| 1399 | hidden | 255px |
| 1440 | shown | 52px |
| 1600 | shown | 132px |

Stats-visible collision ≈ 1390px in the mockup → cut-off ≈ 1400px. Long name ("Cyberpunk lookbook
client v2") truncated at 22ch still leaves 38px on the left at 950.

Card corner icon: small chip bottom-right, same chip look as the bottom-left overlay
(`--surface-bar` 58% + `--line-soft` border), `renderIcon`, tooltip = kind label. Persistent (no
hover, independent of info mode — like the Notes marker). Hidden while that corner is owned by the
preview Continue/Discard row, the queued Cancel row, or the cooking mascot.

## 4. States

| State | User sees |
|---|---|
| Default | FILTER, no dot |
| Filtered (any kind hidden, or Favourites/Previews on) | Heat dot; tooltip `Filtered: Videos, 3D Scenes · Favs` |
| Oldest sort | No dot |
| Nothing matches | Small mascot + "No cards match" + SHOW ALL (DESIGN.md names the mascot for the empty filter result) |
| Archive + filter, empty | Existing "Nothing archived in this filter" copy |

## 5. Panel interaction

- Top bar: `ALL  NONE` left, `Newest | Oldest` segmented right. ALL resets types + flags; NONE hides every type.
- Rows: check/circle toggle, label, kind icon, ON/OFF word. Divider label `ONLY` before Favourites / Previews.
- FILTER click toggles. Row clicks keep it open. Pointer leaves the panel → close after 300ms; re-entering cancels. Outside click / Esc close.
- Keyboard: Enter opens and moves focus into the list; Esc closes and returns focus to the button.
- Motion: 200ms opacity + 4px translate, `var(--ease)`; instant under `prefers-reduced-motion`.

## 6. Constraints the plan must honour

- New icons needed in `js/utils/icons.js`: `filter`, `cube`. No raw SVG elsewhere.
- Panel is a new component via `ComponentFactory.create()` + BEM, registered per `.claude/rules/components.md`. `MpiPopup` (portals to body) is the existing floating primitive to evaluate first.
- `_getGroupRenderKey` must carry the kind or a selectedIndex change will not repaint the icon.
- Every reader of `gallerySort.filter` is swept (grid predicate, archive empty-state copy, `tests/desktop/gallery-archive.spec.js`, anything else a grep finds).
- `ASSET_KINDS` in its own module (`js/utils/assetKinds.js`) so Node can unit-test it — same reason as `galleryRenditions.js` (MpiGalleryGrid imports by absolute browser path).
- Moving controls into the project bar touches `MpiProjectName` and `MpiGalleryBlock`. **MPI-623 (parked in `doing`) claims `js/components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js`** — sequence or coordinate; never edit around the claim.
- Snapshot rules apply: CSS vars only, `qs`/`on`, `Hotkeys.bind`, `Events` with stored unsubscribes, `el.destroy()` for listeners.

## 7. Out of scope

- History workspace project bar shows `0 ENTRIES · 0 KB` for a group with entries — separate bug, spun off to its own session 2026-09-14.
- Counts per filter row, a "12 of 93" readout, character / MIDI / stems kinds (rows added when those kinds exist).

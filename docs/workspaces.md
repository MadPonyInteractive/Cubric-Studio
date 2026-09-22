# Workspaces

Three primary workspaces + one hidden dev area.

## Flow

```
Landing → Gallery → Group History
```

## Landing (`#page-landing` DOM element)
Handles project selection and creation. Entry point when no project is open.
- UI logic lives in `js/shell/projectUI.js` — no separate workspace class.
- **The project list rows are HAND-BUILT divs, not a component.** `loadProjectGrid()` →
  `_buildProjectRow()` creates `.mpi-landing__pl-row` elements directly, so any row change goes
  in `_buildProjectRow` + `styles/shell/landing.css` (`.mpi-landing__pl-*`). **There is no
  `MpiProjectCard` to look at** — the Landing list has not rendered from it since the Stage
  redesign, and MPI-739 deleted the component outright once the gallery preview proved to be
  its last mount anywhere. MPI-286 lost its first pass reading it; do not re-create one.
- Thumbnails load through a **cap-3 concurrency queue** (`_runThumbQueue(loaders, 3, signal)`),
  newest-first (the server sorts `updatedAt` desc). Each row shows a per-thumb `.spinner`
  (`--loading`) swapped for media on load and is **open-locked** while loading
  (`.mpi-landing__pl-row--loading` → click early-returns) until its thumb resolves. Video
  hover-play + `preload='metadata'` were dropped — `metadata` forced every video header up front,
  defeating the queue; rows now show a static first frame via `preload='auto'` + `loadeddata`.
  The goal was **felt**-faster, not actually-faster.
- New Project dialog: `MpiNewProject` compound.
- Header actions: `MpiSettings`, `MpiRemote`, `MpiHotkeys`, `MpiAbout` (in `js/components/Compounds/LandingPages/`, except `MpiRemote` in `js/components/Blocks/MpiRemote/`).
- Background: animated shader via `js/components/shaderBackground.js`.

## Gallery (`js/components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js`)
Default view when a project opens. Lazy-loaded by `js/shell/navigation.js` on `PAGE_GALLERY`.
- Mounts `MpiGalleryGrid` into the tool container.
- Mounts `MpiPromptBox` Organism directly into `#prompt-box-mount` (`gid('prompt-box-mount')`); keeps handle in `_pb` and destroys before remount / in `el.destroy`.
- `MpiCompareOverlay` and `MpiOkCancel` (delete dialog) are workspace-owned singletons.
- Selection: ctrl/cmd-click toggles card, shift-click range-selects, right-click opens `MpiContextMenu`. No `MpiSelectionBar`.
- Navigates to Group History on card open: `navigate(PAGE_GROUP_HISTORY, { groupId })`.

## Group History (`js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js`)
Opened when user clicks a card from gallery. Lazy-loaded by `js/shell/navigation.js` on `PAGE_GROUP_HISTORY`.

**Photoshop-style layout** (`grid-template-columns: 3.5rem 1fr 14rem`):
- `#left-slot` — `MpiHistoryTools` vertical radio toolbar (prompt / crop / mask-group / upscale / interpolate)
- `#centre-slot` — `MpiCanvasViewer` (image), `MpiVideoViewer` (video) or `MpiGifViewer` (gif, MPI-769)
- `#right-top-slot` — active `MpiToolOptions*` compound (swapped by mediator on tool change)
- `#right-bottom-slot` — `MpiHistoryList` (ctrl/shift/right-click selection, dimensions, context menu)
- `#prompt-box-mount` — shell-level PromptBox (centre-bottom floating); shown/hidden via `mpi-group-history-block--prompt-active` CSS class. Never mounted for a `gif` group (no model generates a GIF in v1) — `_shouldShowPromptBox()` is the one gate every mount/show path funnels through.
- `#controls-mount` — shell-level, directly BELOW `#prompt-box-mount`; video groups mount `MpiVideoControlBar` here (MPI-731), gif groups mount `MpiFrameStrip` then `MpiGifControlBar` as two siblings in the same slot (MPI-769) — the strip sits visually above the bar by DOM order. It used to be the block's last grid row, which put it right above the PromptBox, and the PromptBox's upward strips covered its buttons.

**A card's `type` decides image vs video; an ITEM decides gif (MPI-769).** A
GIF card is still an ordinary `type: 'image'` sidecar (`docs/gif.md`) — the
group's own `type` never changes, so `MpiGroupHistoryBlock` reads
`kindOfItem()` (`js/utils/assetKinds.js`, same precedent as a 3D Scene) off
the initially-selected history entry to decide `historyKind` (`'image' |
'video' | 'gif'`), kept deliberately separate from the existing `modeKind`
(`'image' | 'video'`) that drives model-type lookups — a gif group has no
model, so those stay on the image branch. `historyKind` picks the viewer
(a small mount table replacing the old `isVideo` ternary) and the rail's tool
list (`MpiHistoryTools`'s own `{ image, video, gif }` table); `gif`'s tool
list is empty-but-routed until MPI-771/772/773 land panels into it. Every
entry in one group is the same kind by construction (Update rewrites the
current entry, Apply appends another GIF revision), so checking the first
entry is enough for the whole workspace.

**GIF frame strip + control bar (MPI-769).** `MpiFrameStrip` is a full-width
row with a fixed centre marker — the current frame always sits under it, and
the strip slides as playback advances or the user scrubs. Click a thumbnail
to jump; drag one to reorder; ctrl/cmd-click toggles a multi-select the
`gif.frame.delete` hotkey (Backspace — NOT `history.selection.delete`/Delete,
see `js/managers/hotkeyRegistry.js`'s "GIF Player" section for why sharing
that key would also delete the whole history entry) drops. Both edits STAGE
in the strip's own working copy and show a pill (frame-change count +
Update/Apply); nothing reaches the server until one of those fires. `Update`
POSTs `mode:'update'` to `/gif/entry` (rewrites the current history entry,
new built `.gif` filename per `docs/gif.md` E5); `Apply` POSTs `mode:'new'`
(appends a fresh entry, same `appendToHistory` shape every other tool's Apply
uses). `MpiGifControlBar` is a SIBLING of `MpiVideoControlBar`, not a mode of
it — a GIF's delays are per-frame, not a constant fps, so it drives a
`MpiGifViewer` instance directly instead of a `<video>` surface; its embedded
`MpiTrimBar` runs in frame-index units (`fps: 1`) rather than seconds. It
reuses the `video.playPause` / `video.frame.back` / `video.frame.forward`
hotkey ids — a card mounts this bar or the video one, never both, so they
never compete for a keypress.

**Mediator:** `mountOptions(mode)` destroys the previous `MpiToolOptions*` instance and mounts the new one. `prompt` is special — no compound; toggles `mpi-group-history-block--prompt-active` CSS class (shows PromptBox, hides `#right-top-slot`). Tool options compounds: `MpiToolOptionsCrop`, `MpiToolOptionsMaskDetect`, `MpiToolOptionsMaskPoints`, `MpiToolOptionsUpscale`, `MpiToolOptionsInterpolate`, `MpiToolOptionsResize`, `MpiToolOptionsPrompt`.

**PromptBox gating:** `_hasPromptOps()` — true iff active model exposes ≥1 enabled prompt op. Recomputed on model/install-state changes. Video groups with prompt-capable models get PromptBox too.

**Media contract — IMAGE groups (MPI-721).** The media strip IS the slot order, and nothing a run consumes is off-screen.
- The **active entry is an ordinary numbered chip**, pinned: no remove pill, still reorderable. `_setCurrentIdx()` is the ONE place the selection moves and it re-points the chip through `_syncEntryChip()` → `promptBox.el.setPinnedMedia()`. A new site that writes `_currentIdx` directly is a stale chip.
- Reference media arrives through the **`+` card** at the head of the strip (`stageMedia: true` → `MpiMediaPicker`), or by dropping onto the PromptBox itself. **Order is meaning:** `_withAssignedRoles` fills the op's slots by strip position, so chip 1 is an edit's base — but on `control` it is the depth/pose map and the subject sits behind it. Reorder to choose.
- The `+` card's overlay has a **second destination (MPI-887)**: an **Add to history** toggle in its head (`toHistoryLabel`, a toggleable `MpiButton` shaped like the FILTER button beside it) that makes the pick an **entry on this card's history** instead of a reference chip. A picked card is COPIED first (`POST /project-media/:id/copy-item`, sidecar and renditions with it) because deleting a history entry deletes its file; an imported file is not, it is already this project's. The PromptBox emits `stage-to-history` and the Block appends. This is how an image from a DIFFERENT gallery card reaches **Composite**, whose slot only ever took an entry already in the open card's history. Off by default, and deliberately not remembered between opens.
- `mediaItems` is passed to the dispatch **as-is**. No prepend, no discard — prepending the entry would double it. This supersedes MPI-351's clear-at-mount + discard-at-run workaround, and does it structurally: that bug was an INVISIBLE chip owning `Input_Image`, and there are no invisible chips here.
- **Nothing persists.** `workspaceKey: 'history'` writes no `state.promptMedia` slot and restores none; the entry is rebuilt on every mount, references are per-edit.
- `_baseCtx.imageCount` has no `Math.max(1, …)` floor — the entry is counted as a chip. The initial `{ imageCount: 1 }` stays: it is the bootstrap that unlocks the op list before any PromptBox exists.

**The two drop zones are separate, and deliberately so.** `MpiMediaDropOverlay` (`inset: 0` on the *block root*) takes the full-area OS-file drop and fills the **Place** slot (MPI-454). The PromptBox stages a **chip** — `#prompt-box-mount` is shell-level (`index.html`), *outside* the block root, so the full-area overlay never covers it. Video groups keep the chip path on both (start/end frames).

**VIDEO groups are not this.** Their source clip is never a chip: frames come from `MpiToolOptionsPrompt`'s dedicated start/end slots, the strip stays CSS-hidden, and `_generationFromPromptPayload` still resolves the current item in code. The two branches are split on purpose — do not collapse them.

## Shell-level singletons (always present)
Mounted once in `js/shell.js`, independent of active workspace:
- `MpiErrorDialog` — shown on `ui:error` event
- `MpiStartingComfy` — shown on `comfy:starting` / `comfy:ready` events
- `MpiSlideOver` — hosts slide-over content components (`MpiSettings`, `MpiHotkeys`, `MpiAbout`, `MpiModelManager`); opened via `slide-over:open { title, component }`. `models:open` is re-emitted by shell as `slide-over:open { title: 'Models', component: MpiModelManager }`.
- `#prompt-box-mount` slot — declared in `index.html`; Blocks (Gallery, History) mount `MpiPromptBox` Organism directly into it. Slot persists across workspace switches; each Block destroys its prior `_pb` handle before remount and in `el.destroy`.
- `#controls-mount` slot — declared in `index.html` after `#prompt-box-mount`; only Group History (video) mounts into it, and the bar's instance `destroy()` empties it. The Flow `main-area` overlay stashes it with the other `.main-area` children; focus mode leaves it visible.

**Zero-model gate:** When a new/empty project opens with no installed models, Gallery auto-emits `models:open`, opening the Models slide-over. A project that already has media opens read-only with no PromptBox until ≥1 model is installed. PromptBox mounts once `s_installedModelIds` is non-empty (keyed off `state:changed`, not a `models:closed` event).

**Landing page nav actions:** `Models · Settings · Hotkeys · About` — all open via `slide-over:open`. `Models` is first in list.

## Routing
- `js/router.js` defines `PAGE_LANDING`, `PAGE_GALLERY`, `PAGE_GROUP_HISTORY`.
- `js/shell/navigation.js` handles page transitions: `handleNavigation(page, params)`.
- `shell.js` registers `onNavigate()` → calls `handleNavigation()`.
- Never use `window.location` — always go through `navigate()` / `back()` from `router.js`.

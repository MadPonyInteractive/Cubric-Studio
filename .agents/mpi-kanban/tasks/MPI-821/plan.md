# MPI-821 — Archive replaces the reuse asset store

Fabio, 2026-09-19. Archive now covers what `.preview-assets` was invented for, so the
hidden copies go. Four parts, all shipped; one user-ux check remains.

## Current State

### What `.preview-assets` actually is today

One content-addressed store, `Media/.preview-assets/<sha256><ext>`, written by
`placeContentAsset` (`routes/projects.js:410`). Nothing ever deletes from it except the
manual Cleanup. Three DIFFERENT jobs ride it, and only the first is the one the card
describes:

| # | Job | Written by | Does the source have a gallery card? |
|---|---|---|---|
| A | Snapshot the INPUT images of an image-input op so Reuse can re-chip them | `materializeGenerationFrameSnapshots` (`:702`), and the `stage === 'preview'` snapshots in `materializePreviewAssets` (`:571`) | **Yes** — the user picked a card |
| B | Stage a file that has NO card at all | `POST /project-media/:id/place-preview-asset` (`:1824`), called by the agent's `placeAsset` (`services/agentTools.mjs:215`) and by a Flow's OS-file drop (`MpiBaseFlow.js:935`) | **No** — an agent scratch file, or a file dragged off the desktop |
| C | Multi-stage LATENTS | `_materializeLatent` inside `materializePreviewAssets` | n/a — lands in `Media/.latents/`, **not** in this store, so it is untouched either way |

The card's rationale — *"the source stays a real gallery card and Archive hides it"* — is
true for **A** and false for **B**. Retiring the store outright would break the agent
media contract, documented in three shipped skills (`cubric-vision-generate`,
`cubric-vision-flows`, `cubric-vision`), `docs/agent-chat.md` and
`routes/connector.js:47,427`, plus every OS-file drop into a Flow slot.

**Fabio's answer, 2026-09-19: NARROW.** Job A goes, job B stays, existing sidecars are
left alone.

### The Cleanup trap that had to be fixed with part 4

`/backfill-media-derivatives` gates on the **sidecar**, never on disk —
`if (meta.thumbPath) continue` (`routes/projects.js:1690`), and the same shape for image
and video. A cleanup that deleted `<id>.thumb.*` but left `meta.thumbPath` pointing at it
would make the backfill skip that item **forever**. An image card falls through to
`filePath`; a video card cannot, so it would be a blank grey tile for the life of the
project. Part 4 therefore nulls `thumbPath` / `thumbPathLg` / `proxyPath` with the files.

`DERIVATIVE_RE` also matches `<id>.splat.ply`, which is **not** a derivative — the still is
rendered FROM the `.ply`, so it is the master. Cleanup uses its own narrower
`CLEANUP_DERIVATIVE_RE` (thumb|proxy) rather than reusing `DERIVATIVE_RE` or
`removeItemThumbs`.

## Completed

### Part 1 — Archive moved down the card context menu
`MpiGalleryGrid.js` — the `archive` entry now sits directly above `delete`, which stays
last. The MPI-678 "labelled off the card's own state" comment moved with it.

### Part 2 — the delete confirm gained a third action
- `MpiOkCancel` takes an optional `altLabel` (a third button between Cancel and the
  confirm, emitting `alt`) and an optional `okVariant`. Both default to today's behaviour,
  so every other caller is unchanged.
- `MpiGalleryBlock`'s delete dialog is now **Cancel / Archive / Delete**, Delete rendered
  `danger`. `on('alt')` sets `archived = true`, persists through `updateGroup`, and
  re-runs `setGroups` so the scope gate drops the cards from the gallery — the same
  mutate-then-persist the context menu's Archive does. `on('cancel')` clears the pending
  set, which it never did.
- **Enter still confirms Delete.** Enter was the gesture that opened the dialog; an Enter
  that quietly archived instead would be the worse surprise. Archive is a click only.
- Button ORDER is Cancel / Archive / Delete, not the card's literal "Cancel / Delete /
  Archive": the destructive action keeps the danger styling and the rightmost/confirm
  slot that Enter maps to. Flagged to Fabio.

### Part 4 — "Cleanup assets" repointed at the derivatives
- `cleanupRebuildableAssets(folderPath)` extracted and exported from `routes/projects.js`
  (a route body cannot be unit-tested). `POST /project/cleanup-assets` is now three lines
  over it.
- It removes `Media/.meta/<id>.thumb.*` and `<id>.proxy.*`, nulls the three sidecar
  fields, keeps `<id>.splat.ply`, the sidecar JSON, the masters and `.latents/`, and still
  wipes the preview-assets store (preserving `.migrated-v1`) — that wipe leaves with part 3.
- Dialog copy in `projectUI.js` now describes the pre-share slimming step.
- Cleanup runs from the **Landing** project-row menu, so no project is open and no live
  card is looking at a URL that just went away.

**Verified:** `node --test tests/cleanup-derivatives.test.cjs` (3 pass) and
`node --test tests/content-addressed-store.test.cjs` (3 pass, exports intact);
`npx playwright test --config=playwright.desktop.config.js tests/desktop/delete-offers-archive.spec.js`
(2 pass); eslint clean on all five touched files.

## Completed — part 3 (narrow) and the menu reorganisation

### Part 3 — job A retired, job B kept
- `materializeGenerationFrameSnapshots` and `_snapshotRoleForMediaItem` are gone, with
  both call sites: `POST /project/save-generation` and `/extend-video`
  (`routes/videoConcat.js`). `generationSettings.mediaItems` is no longer rewritten, so
  it keeps each input's own project url and Reuse re-chips the SOURCE CARD.
- `materializePreviewAssets` records a REFERENCE — `{ id, role, mediaType, originalUrl,
  url, status }` — copies nothing, and hands `frozenParams` back untouched (the rewrite
  that repointed it at the copy left with the copy). The latent leg is unchanged: latents
  live in `Media/.latents/`, never in this store.
- **`GET /validate-preview-assets` had to learn `snap.url`.** It built its candidate paths
  from `filePath` / `relativePath` / `filename` only, so every freshly written snapshot
  would have read as `missing` → `canColdFallback: false` → a multi-stage Continue
  BLOCKED with everything it needed on disk. Found by reading the consumer, not by a test.
- **Kept:** `placeContentAsset`, `POST /project-media/:id/place-preview-asset`,
  `migratePreviewAssetsStore`, and the store itself. Job B has no gallery card for Archive
  to keep.
- **Existing sidecars are left alone.** Every reader already takes `filePath || url`, and
  a ref to a file that is gone is dropped by `resolvePromptReuseMediaItems`, which HEADs
  every url before it chips anything. Zero migration.
- **Orphans removed with them:** `snapshotExt` (no callers left) and the `source` field on
  the grid's `delete` event (its only consumer was the short-circuit below; `types.js`
  never documented it).
- **Accepted regression, stated:** the server-side positional role fallback
  (`_snapshotRoleForMediaItem`) went with the copier. It only covered role-LESS chips, and
  `MpiPromptBox._withAssignedRoles` fills every declared slot by `mediaType` before a
  generation is dispatched, so nothing generated through the PromptBox produces one.

### The context menu, reorganised (Fabio, 2026-09-19)
Three groups, two separators, coarse → fine → irreversible:

| group | rows | why |
|---|---|---|
| make something NEW from the selection | Compare · Combine · Make GIF · Cue all | none of them touch the cards |
| edit THIS card's own data | Rename · Card notes · Describe image | Describe was not in Fabio's list; it writes a prompt onto this card, so it sits here — flagged |
| files and the system | Add to project · Open in file system · Download · Archive · Delete | ends on the two answers to "get this off my gallery" |

`MpiContextMenu` already supported `separator: true` and `info`; nothing in the repo used
either. Every row now carries `info`, and every DISABLED row carries its reason — this app
has no tooltips, so `data-info` → the status bar is the only place a row can explain
itself, and a greyed row with no reason is the case that actually hurts.

### Right-click Delete now confirms
`MpiGalleryBlock`'s `delete` handler short-circuited on `source === 'context'` and deleted
the cards and their media files outright. Every delete goes through the dialog now, which
is also what makes part 2's Archive reachable by mouse.

## Verification

**Verify mode:** user-ux

- `npm test` — 1386 pass, 0 fail, 1 skipped.
- `tests/cleanup-derivatives.test.cjs` (3) — derivatives dropped, splat and masters kept,
  sidecar fields nulled, idempotent.
- `tests/reuse-refs-not-copies.test.cjs` (3) — a preview snapshot is a ref with no
  `filePath`, the store is not even created for a gallery-sourced input, `frozenParams`
  comes back as the SAME object, and `placeContentAsset` still works for job B.
- `tests/desktop/delete-offers-archive.spec.js` (3) — the exact three-group menu order
  with both separators, every row carrying `info`, right-click Delete opening the confirm
  with the card still on screen, and Enter confirming Delete rather than Archive.
- `tests/desktop/gallery-archive.spec.js` (3) + `gallery-cue-all.spec.js` (1) — the
  neighbours of the menu I re-ordered.
- eslint clean on every touched file.

**Left for Fabio (user-ux):** the menu grouping and the three-button dialog in the running
app, plus one real Reuse of a card whose input source is still in the gallery.

**Left unrun:** Cleanup on a real project followed by a reopen, confirming thumbnails and
video proxies rebuild through `/backfill-media-derivatives`. That leg needs ffmpeg and a
real project, so it is a live check, not a unit test.

## Plan Drift

- Part 2's button order is Cancel / Archive / Delete, not the card's literal
  "Cancel / Delete / Archive" — Delete keeps the danger styling and the confirm slot Enter
  maps to. Fabio approved, 2026-09-19.
- The context-menu reorganisation and the `info` strings were added by Fabio mid-card;
  they are not in the original description.
- Part 4 keeps wiping the preview-assets store alongside the derivatives, because the
  store survived part 3 and that wipe is still its only GC.

## Preservation Notes

- The A/B/C table above is the durable finding and now lives in
  `docs/project-integrity.md` § `previewAssets`. The Cleanup traps live in `docs/gallery.md`
  § "The rendition ladder": the sidecar-gated backfill, and `.splat.ply` riding
  `DERIVATIVE_RE` while being a master.
- **Board defect, not mine:** `validate_board.py` exits 1 on 21 violations, all in
  `MPI-771`'s uncommitted `events.jsonl` (legacy-shaped lines missing `schema`/`type`/`id`)
  and their mirrors in the global log. MPI-821 itself is clean.
- **Related:** MPI-815 (Elements) copies nothing into a project *because* of this card.

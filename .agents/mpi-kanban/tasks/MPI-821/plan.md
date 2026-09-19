# MPI-821 — Archive replaces the reuse asset store

Fabio, 2026-09-19. Archive now covers what `.preview-assets` was invented for, so the
hidden copies go. Four parts; three are shipped, one is blocked on a scope decision.

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
true for **A** and false for **B**. Retiring the store outright breaks the agent media
contract, which is documented in three shipped skills
(`cubric-vision-generate`, `cubric-vision-flows`, `cubric-vision`),
`docs/agent-chat.md`, and `routes/connector.js:47,427`, plus every OS-file drop into a
Flow slot. See § Open question.

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

## Remaining Work

### Part 3 — retire the reuse asset copying — **BLOCKED**

Blocked on the scope question below. Once answered:

- [ ] Job **A** goes: `materializeGenerationFrameSnapshots` stops copying, and the
      `stage === 'preview'` snapshot leg of `materializePreviewAssets` with it. The
      sidecar records the SOURCE card's media url; Reuse resolves it live.
- [ ] `js/utils/promptReuse.js` already soft-fails a snapshot that no longer resolves
      (`:197`) — confirm that path covers a source card that was **deleted**, not just one
      whose store entry was cleaned.
- [ ] Job **B** keeps or loses `placeContentAsset` per the answer.
- [ ] Existing sidecars carrying `previewAssets` refs: see below.
- [ ] `docs/data.md` / `docs/project-integrity.md` / `docs/playbooks/add-flow/03-storage-and-reuse.md`
      all describe the store; update whichever survive.

## Open question — asked 2026-09-19, awaiting Fabio

**Does part 3 retire the whole store, or only the copies that duplicate a gallery card?**

- **Narrow (recommended).** Job A goes; job B keeps `placeContentAsset` and
  `place-preview-asset` for files with no card. The card's own reasoning only covers A,
  and B is a published agent contract.
- **Wide.** The store goes entirely; an agent-staged or dropped file becomes a real
  gallery card the user archives. Consistent, and much larger — it changes the agent media
  contract and the Flow drop path, and needs its own card.

**Sub-question: existing projects whose sidecars already carry `previewAssets` refs.**
Recommendation: **leave them.** A ref to a missing file already soft-fails to a warning
toast (that is the documented post-Cleanup behaviour), so an existing project keeps
working until its store is cleaned. Zero migration, zero code.

## Plan Drift

- Part 2's button order departs from the card's literal wording — see Part 2 above.
- Part 4 keeps the preview-assets wipe for now instead of replacing it outright, because
  removing it before part 3 lands would leave the store with no GC at all.

## Verification

**Verify mode:** user-ux — Fabio judges the menu position and the three-button dialog in
the running app. The disk behaviour of Cleanup is `auto` and is already proved by
`tests/cleanup-derivatives.test.cjs`.

Not yet run end to end: Cleanup on a real project followed by a reopen, confirming the
thumbnails and video proxies come back via `/backfill-media-derivatives`. That leg needs
ffmpeg and a real project, so it is a live check, not a unit test.

## Preservation Notes

- The A/B/C table above is the durable finding. Its home is `docs/data.md` when part 3
  lands, not this plan.
- **Found, not fixed (not this card's job):** right-click → Delete deletes with **no
  confirmation at all** — `MpiGalleryBlock.js:1162` short-circuits on
  `source === 'context'`, so only the Delete *key* reaches the dialog. That means part 2's
  Archive is currently reachable only from the keyboard path. Raised with Fabio.
- **Board defect, not mine:** `validate_board.py` exits 1 on 21 violations, all in
  `MPI-771`'s uncommitted `events.jsonl` (legacy-shaped lines missing `schema`/`type`/`id`)
  and their mirrors in the global log. MPI-821 itself is clean.
- **Related:** MPI-815 (Elements) copies nothing into a project *because* of this card.

# MPI-963 Plan - small previews show the sidecar thumb, not the original

## Current State

- **Umbrella:** MPI-962 (Big photos). Brief in `brief.md`. Ordered FIRST, before MPI-961 Phase 3
  (Fabio, 2026-09-28, "go with that order"): the rows cost dominates every 16K open / Prompt swap.
- **Measured (MPI-961 Phase 1 control, rows faked onto thumbnails):** 16K idle open 37.1 s -> 5.0 s
  (longest main-thread block 27.8 s -> 2.6 s); 4K Prompt<->tool swaps 5 s -> 0.35 s. A 16K `<img>`
  row is re-decoded (~2.3 s) whenever the compositor re-rasters it, and the stall lands inside
  unrelated main-thread work. MPI-961 `validation.md` § Control.
- **Sites (code read 2026-09-28):**
  - `js/components/Compounds/MpiHistoryList/MpiHistoryList.js` `_makeCard` (~:138): an IMAGE row
    gets `item.filePath` (the original); video already uses `thumbPath` only. Row box is 64x44 CSS
    px, so the 512 `thumbPath` is plenty.
  - `routes/projects.js` `findRecentProjectThumbnail` (~:163): the Landing card gets
    `projectFileUrl(top.path)` - the newest card's original (a 32K import = blank card).
  - Sweep: gallery grid and `MpiMediaPicker` tiles already use `thumbPath || filePath`. Out of scope
    (they show media LARGE, a display-copy job): `MpiMediaPicker` full preview (:296), the agent
    chat result tile (`MpiAgentChat.js` :851).
- Every sidecar in the Big Photos fixture carries `thumbPath` (512 webp), and `thumbPathLg` (1280)
  when the source is > 1280 - the 32K included.

## Decisions

- History row: `thumbPath || filePath` for images (original only when a sidecar has no thumb;
  the backfill pass in `routes/projects.js` fills old ones).
- Landing: the newest candidate's sidecar `thumbPath`, resolved to disk and checked to exist, then
  served with `projectFileUrl`; its type is `image` (a thumb is always a still - for a video it is
  the same first frame the card already paints, minus a video header load). No thumb on disk ->
  today's behaviour (the original, typed by its extension).

## Phase 1: Implement + verify

- [x] `MpiHistoryList.js` image rows prefer `item.thumbPath`.
- [x] `findRecentProjectThumbnail` prefers the sidecar thumb; export it for the unit test.
  **Verify:** new `tests/recent-project-thumbnail.test.cjs` (temp project: newest sidecar with a
  thumb -> the thumb's URL + `image`; thumb missing on disk -> the original; video with thumb ->
  thumb + `image`); new desktop spec `tests/desktop/history-list-thumbs.spec.js` (a > 1280 image
  entry: its History row `src` is the `.thumb.webp`, not the original) - fails on HEAD;
  `npm test` touched suites + `landing-grid-release`, `history-modes` desktop specs.

## Phase 2: Close (user-ux)

- [ ] **Fabio:** relaunch; Landing card for Big Photos Test shows a picture; opening the 16K card no
  longer paints rows top-down; the 32K row shows its thumbnail. Then commit, CI green, close.

## Verification

**Verify mode:** user-ux

## Plan Drift

- 2026-09-28: Phase 1 done and measured (`validation.md`); card to `validating` for Fabio's check.

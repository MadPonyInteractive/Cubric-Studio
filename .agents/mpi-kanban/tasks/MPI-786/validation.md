# MPI-786 validation

## Root cause

`navigation.js` only HIDES `#page-landing` when a project opens, so `projectUI.js`'s grid kept
running behind the gallery: its cap-3 thumbnail queue kept loading preview clips (14-16 more media
requests after leaving), and nothing ever dropped a clip's `src`. A hidden, paused
`preload="auto"` clip keeps a range request (`bytes=65536-`) open until Chromium idle-suspends
it ~15 s later. The app server is HTTP/1.1 on one host (Chromium: 6 connections per host), and
the renderer holds 3 of them permanently with EventSource streams (`/concat/events/stream`,
`/connector/jobs/stream`, `/agent/stream`). Three such clips fill the pool, and every other
request (the save, the gallery's own clip, `/system/stats`) is held until the clips' loaders are
cancelled at +15.0 s.

Timeline of one stalled run (CDP, seconds relative to the save's creation): three landing clip
range requests open at -0.76, cancelled at +15.01/+15.02; the save, the gallery clip, a fourth
landing clip and 8 `/system/stats` polls all sent at +15.03. Save timing: 15002 ms queued before
send, 11 ms in the server.

## Fix

- `js/shell/projectUI.js`: `releaseProjectGrid()` aborts the batch AbortController (thumbnail
  queue + row stats) and empties the grid. Each video row registers an abort listener that drops
  its `src` and calls `load()`, which covers clips not yet swapped in too. `loadProjectGrid()`
  builds nothing when its render was aborted while the list loaded.
- `js/shell/navigation.js`: `_showShell()` (the one place the landing gets hidden) calls it.
  `loadProjectGrid()` already rebuilds on the way back.

## Evidence

Real app (own Electron, no `CUBRIC_E2E`, GPU on, fresh scratch profile, empty scratch engine root,
free port; landing lists the machine's real projects read-only; saves go to a scratch project).
Script: session scratchpad `repro.cjs` (mode "video": leave once a landing clip is mounted, then
5 sequential `POST /update-project` + 1 GET).

| build | runs | first save stalled | first save times |
|---|---|---|---|
| release call disabled | 10 | 6 | 14945, 38, 14949, 22, 14928, 32, 21, 14943, 14947, 14949 ms |
| fix | 10 | 0 | 11-14 ms |
| fix (final, restored code) | 6 | 0 | 12-49 ms |

With the fix: 1-2 media requests after leaving (the gallery's own clip), no landing `<video>` left
in the document. Without: 14-16 media requests after leaving, 15 landing clips left mounted.
Staying ON the landing (release not involved): 24 saves over 3 runs, max 85 ms.

Under `CUBRIC_E2E` (GPU off) the stall did not reproduce today with the release disabled
(6 repro runs incl. the spec's own timing, 3 runs of `gallery-filter-panel.spec.js`), so that
spec cannot guard this. New `tests/desktop/landing-grid-release.spec.js` pins the release with a
stubbed `/list-projects` fixture row: green 3 of 3; RED with the navigation call removed (rows 1,
src kept, networkState 1) and RED with only the per-video release removed (rows 0, src kept,
networkState 1). Both mutations restored and checked.

- `tests/desktop/gallery-filter-panel.spec.js`: `SAVE_WAIT` and its comment removed; green 3 of 3
  on the default poll timeout (7.4-7.6 s per run).
- `npm test`: 1219 pass, 0 fail, 1 skipped.
- Desktop suite (`--config=playwright.desktop.config.js`, private output dir): 100 pass, 2 fail:
  `toast-click-dismiss` and `toast-serial-countdown`. Not this card: `toast-click-dismiss` fails
  3 of 4 with both MPI-786 files set to their HEAD contents; `toast-serial-countdown` passed 2 of
  2 alone. Flagged as a separate task.
- `npx eslint` on the four touched JS files: clean.

## Docs

- `docs/shell.md` § projectUI.js: the release and why (stale one-line description replaced).
- `docs/testing-desktop-specs.md`: new section on queued requests (how to measure the queue over
  CDP, specs boot onto the developer's real project list, E2E only sometimes reproduces it).

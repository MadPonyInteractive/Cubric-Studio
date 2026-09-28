# MPI-966 validation

Fix commit: `c5beec991`.

## Cause (measured)

Backend is not the slow part: on Fabio's 63 projects, `POST /list-projects` answered in
344-387 ms warm, `/engine/version-check` 2-4 ms, `/engine/deps-status` 8-18 ms (one router
on a spare port).

The window revealed on `ready-to-show` + `did-navigate` + `did-finish-load` - all page-load
signals. The project list and the crew clips arrive AFTER the page loads, so the reveal raced
them. Isolated instance (`CUBRIC_BACKGROUND=1`, own profile + port), sampled every ~30 ms:
one run revealed at 2272 ms with 0 project rows, the crew held and 0 clips decoded; rows
landed 600 ms later. Screenshot matched the report: mascot names over an empty stage, a
spinner in the picker, "No sessions yet".

## After

Same probe, three runs with the 18+ notice and changelog pre-acknowledged (Fabio's normal
boot): every reveal had 63 rows, crew released and all 5 first clips at readyState >= 2.
Reveal at 3.5 s / 5.2 s / 5.9 s after launch; in the later two, content was ready ~1.5 s
earlier and the rest was the pre-existing `did-finish-load` wait (the page load event waits on
thumbnails inserted before it fires) - unchanged by this card. First-run profile (18+ modal
up): reveal at 3.6 s with rows and clips ready, modal on top.

## Checks

- `npm test`: 2179 tests, 2177 pass, 2 skipped, 0 fail.
- Desktop specs: electron-smoke, empty-state-mascots, fullscreen-titlebar, cancelled-mascot - 4/4 pass.
- eslint clean on the four source files.

## Remaining (human)

Does the startup now look right on Fabio's own launch (cold, real profile)?

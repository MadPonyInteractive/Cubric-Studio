# MPI-839 - validation

## Half 1 - media, sidecar and card land in the origin project (ae42ebcf, 2026-09-20)

CI green, run 35501171986. 1530 tests, 0 fail.

## Half 2 - the placeholder, and the queued job (2026-09-20, uncommitted at time of writing)

- `node --test tests/generation-project-pinning.test.cjs` -> 8 pass. New: the registry scopes
  `listFor('gallery', null, <folderPath>)` (A's render is not painted in B, switching back finds it,
  the unscoped read still sees everything); the project freezes at ENQUEUE before `_cueQueue.push`;
  the gallery reads placeholders through the scoped list.
- `npm test` -> 1538 tests, 1537 pass, 0 fail, 1 skipped (live key). `npm run lint` clean.

## OWED - Fabio's eyes, one app restart

Dispatch a clip in project A, switch to B mid-render: NO spinner in B. Switch back to A: the spinner
is there. The card lands in A. Not checkable from a test - it needs a real render across a real switch.

## Live - PASSED (Fabio, 2026-09-20 ~10:27Z, after restart at 10:25:05Z)

He dispatched a clip in "Cowgirl on a Bull", switched to another project and back. In his words: the
generation was running only in the Bull project. The placeholder half is confirmed. Where the CARD
lands was not seen this round: he cancelled that clip himself (app.log 10:28:02Z CANCELLED).

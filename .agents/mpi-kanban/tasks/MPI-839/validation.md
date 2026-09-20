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

## Live - the card landing: FAILED, fixed, needs ONE more check (2026-09-20)

He sat in another project while the cowboy->motorbike clip rendered. Media, sidecar, proxy, thumbs and
waveform all landed correctly in "Cowgirl on a Bull" (`Media/t2v_002.mp4`, item a2d5800f, 8 s, 192
frames @ 24 fps, 1344x768, audio) and app.log logged "card registered in the project it was dispatched
in" at 10:52:19.669Z. The card was in NEITHER project, and the chat preview did nothing.

ROOT CAUSE, not the symptom: `_addGroupsToClosedProject` POSTed the in-memory group. On disk a card
carries `history` as item ID STRINGS - `persistGroups` is what converts them, and the closed-project
path never went through it. The route accepted the object form; project.json was rewritten 15 s later
(10:52:34Z) WITHOUT the card, because opening that project runs `reconcileAndHydrate`, which looks each
history entry up as an id, found none, dropped the card as empty and persisted that. Reproduced
directly: the old shape through the real reconciler returns 0 groups, wasModified true.

FIX: `serializeGroup` is exported from projectService and is now the ONE on-disk shape for both paths;
`POST /project-groups` refuses a group whose history is not a non-empty list of id strings, so the wrong
shape can never again land as a card that deletes itself; a test drives card -> serialiser -> real route
-> project.json -> real reconciler, which is the whole path the earlier tests each covered half of. A
false comment claiming reconciliation adopts unreferenced media was corrected - nothing adopts it.

HIS CLIP WAS RECOVERED by hand from the sidecar (card 3a9a06b2, project.json backed up beside itself as
`project.json.bak-mpi839-115727`). 1551 tests, 0 fail, lint clean.

STILL OWED: one more live run - dispatch, switch away, let it land, and open the origin project. The
card must be there after the reopen, which is the step that deleted it last time.

# MPI-1113 - engine:assets stuck "Download 100%" row in Cue Transfers

## Root cause (proven 2026-10-12)

Neither suspect on the card. A no-op install (every dep already on disk / volume) settles
INSIDE the /download/start handler: `res.json(job)` then `_checkModelJobsComplete()`
broadcasts `download:complete`. MPI-395 already observed live that this SSE event can
reach the renderer BEFORE the POST response. The complete handler marks the job
`complete` and clears `_silentJobs`; then `_firePost` adopts the POST body with a
hard-coded `status: 'downloading'`, resurrecting the settled job at 100%, now unsilenced.
The snapshot handler keeps any client `downloading` job the server no longer lists, so it
never clears. Every connect's `engine:assets` is "fetching nothing", so it races every time.
Hits ANY all-on-disk install, not just engine:assets.

Suspect 2 (remote job never settles) ruled out for this incident: toInstall empty and all
deps installed settles synchronously. Suspect 1 (silence is renderer memory) is a real
second hole: a reload mid-heal restores the job from the server snapshot with no mark.

## Fix

1. `_firePost`: adopt the POST snapshot only while the client job is still `downloading`
   (the status `_firePost` set) - an SSE terminal that landed first wins.
2. Silence is a fact on the JOB: client sends `silent` in the POST body; server stores it on
   the model job (`registerModelJob`), serializes it (`_serializeModelJob`, store
   `snapshot()`), stamps it on the model-level `download:complete`. Client drops the
   `_silentJobs` set; `isSilentJob` reads the job.

## Verification

**Verify mode:** auto
- New test `tests/download-silent-job.test.cjs`: complete-before-response keeps the job
  complete; silent survives a server snapshot; store/serializer carry `silent`.
- `node --test tests/install-queue-wedge.test.cjs tests/download-*.test.cjs` green.

## Current State

Both fixes in, auto checks green (see validation.md). Uncommitted. Next: close-out
(commit by pathspec: downloadService.js, downloadManager.js, installStore.js, the two tests,
docs/download-manager.md, this card), then MPI-1106 GPU half per the MPI-1102 umbrella.
Live check is Fabio's next Pod connect: no `engine:*` row in Cue > Transfers.

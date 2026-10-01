# MPI-668 - validation

Verify mode: auto (unit test + full `npm test`); the live leg needs Fabio's yes (a few cents).

## Evidence

- 2026-10-01 (session 2a6034eb): `routes/remotePodLifecycle.js` `_isPodImageStale` + reconnect
  step 2a. `tests/runpod-remote-hardening.test.cjs`: new route test "reconnect recreates a pod on
  an old image instead of resuming it" (startPod never called, pod-old deleted, create keeps
  vol-1) + the pure `_isPodImageStale` test; the existing warm-start-fails test now stubs
  `getPod` (it used to reach the real RunPod client). **Proven RED** with the check forced off
  (`const stale = false` -> the new test fails), GREEN with it. eslint clean.
  `npm test`: 2635 tests, 2633 pass / 0 fail / 2 skip.
- Committed `922ce37a1`. Same day, on the same getPod read (MPI-894, Agent 85's live find on
  the Linux box): a RUNNING Pod is attached without `startPod` and skips the availability gate
  (v2 answers `start` on RUNNING with a non-400 error, so a crash-left Pod was deleted). Route
  tests RUNNING / STOPPED, the RUNNING one proven RED on `922ce37a1`'s code.
- NOT yet run live: v2 `GET /pods/{id}` returning `image` is from the v2 create body shape
  (`runpodRemote.js:118`), not observed on a real Pod. A wrong field name fails OPEN (resume as
  before), so the risk is "no effect", never a wrongful recreate. Live leg = the last checklist box.

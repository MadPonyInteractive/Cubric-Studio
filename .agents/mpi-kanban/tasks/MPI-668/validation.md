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

## Live leg - 2026-10-01, Agent 86 (Fabio's yes, cap $0.50) - PASS

Linux box. A FRESH v1.5.0 extract (`~/m668`, from `~/mpi595/CubricVision-linux-x64-v1.5.0.tar.gz`,
key file copied in), driven through its own routes (`~/m668/m668.py`).

- 1.5.0 created CPU Pod `1lqwf5lyvop6qk` + 10 GB volume `ptcgtph87b` (EU-RO-1) on
  `ghcr.io/madponyinteractive/cubric-vision-pod:v0.23.0-cpu`, ready in 23 s; `stop-active` ->
  `EXITED` (a user who quit 1.5.0). 1.5.0's pod read carries `imageName` (v1 shape).
- Updated that install in place to a master build: mpi-ci run 36920031079 at `a1552ef08`
  (bundle's `remotePodLifecycle.js` checked for `_isPodImageStale`), through the installed
  1.5.0 `update.sh` (only `fetch-release.cjs` stubbed). "Applied Cubric Vision update to 1.6.3".
- `POST /remote/pod/reconnect` (the Connect body) -> `{"recreated":true,"podId":"o0y96lc8z0htpt"}`.
  app.log: `Pod 1lqwf5lyvop6qk runs ...:v0.23.0-cpu, this app needs ...:v0.21.0-cpu; recreating it`,
  `Pod delete 1lqwf5lyvop6qk -> http 204`, create on `v0.21.0-cpu`, ready in 28 s. The new Pod
  mounts the SAME volume (`mounts.network[0].volumeId = ptcgtph87b`).
- v2 `GET /runpod/pods/<id>` DOES carry `image` (`...:v0.21.0-cpu`; `imageName` absent). The
  `image || imageName` read covers both shapes; the fail-open branch is not what fired.
- Teardown: both Pods 404, volume deleted (200), account 0 Pods. Spend: two CPU Pods running
  36 s + 46 s (the new one $0.24/hr), the stopped one ~5 min, 10 GB volume ~7 min: **under $0.01**.
- Side note, owned by the cut (MPI-595/MPI-894; the peer confirmed it is tracked and
  `release:check` fails on it): master's frozen stable pins (v0.21.0) are OLDER than v1.5.0's
  (v0.23.0), so until the promote this recreate lands a 1.5.0 user on an older image.

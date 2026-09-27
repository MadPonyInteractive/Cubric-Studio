# MPI-806 validation

Built 2026-09-27 (session 56a78131, one worker + review). Commits: Vision `97f729c5e`,
mpi-ci `e62a9aa`. 2.0 Gate A item A1 of MPI-595.

## Source of truth

The live `https://api.runpod.io/v2/openapi.json` (OpenAPI 3.1, info.version 2.0.0), read
2026-09-27, plus the migration guide. Every request shape in the tests comes from it.

## What changed

- **App client** (`routes/runpodRemote.js`): base `https://api.runpod.io/v2`. Create is
  translated at the REST boundary (`_toV2PodSpec`): `image`, `disk`, `gpu{id,count,
  allowedCudaVersions,minRamPerGpu}`, `cpu{id,vcpuCount}`, `mounts.network[{volumeId,path}]`,
  `ports` / `env` / `dataCenterIds` unchanged. `cloud` defaults to SECURE on v2, as v1 did.
  Start/stop -> `POST /pods/{id}/action`. Volumes -> `/network-volumes`, `dataCenter` on
  create, list unwrapped from `{networkVolumes}` with a `dataCenterId` alias for the renderer.
- **Pod reads** (`routes/remotePodLifecycle.js`): `status`, `startedAt`, `cost`, `disk`,
  `mounts.network[0].volumeId`, `gpu.memory` (= total system RAM on v2, not VRAM),
  `runtime.memory.util`; RFC 9457 `detail`/`title` on the resume error.
- **Review additions**: v2's new `ERROR` status counts as not-running in all three sets
  (`_isPodDead`, the Settings connect poll, the boot poll); `/runpod/pods` sums `cost`.
- **Pod runtime watchdog** (`mpi-ci/.../wrapper.py` `_self_stop`): v2 action call, and a
  non-2xx is now a failure that retries and logs. Before, it printed "self-stop issued"
  whatever came back, so from 2026-11-15 an idle Pod would have billed indefinitely.

## Behaviour v2 takes away (recorded in docs/runpod-remote-engine.md)

- No `machine` object on v2, so the MPI-135 maintenance-host early exit never fires; a bad host
  now falls to the normal readiness watchdog.
- `gpu.id` is a free string on create, so the MPI-159 enum-lag 400 cannot happen and its
  GraphQL fallback goes dormant.

## Evidence (agent-verified)

- `tests/runpod-rest-v2.test.cjs` 14/14 (method + path + body per client function, incl. the
  CPU download-mode body and the CUDA driver floor); `runpod-volume-update`,
  `pod-self-heal-dead` (+ERROR, +PROVISIONING/STARTING), `runpod-remote-hardening`,
  `pod-cpu-flavors`, `pod-disk-total`: 49/49.
- `npm test` 2107 pass / 0 fail / 1 skipped. `eslint` clean on the four JS files.
  `py_compile` clean on `wrapper.py`.

## Still owed — needs Fabio's go (rents a Pod on his key)

1. Live app leg: Connect (create) a GPU Pod and a CPU download-mode Pod, Disconnect (stop),
   Reconnect (start), delete; list + grow a volume.
2. Runtime: `./publish-runtime.sh dev` -> restart a dev Pod -> let the watchdog fire (or call
   `_self_stop`) and see the Pod go EXITED -> `promote`. Never `stable`.

## 2026-09-27 live legs (Fabio ran the app, this session read the log)

- **Runtime on dev**: mpi-ci `a5cf42a` (the v2 self-stop + a log line naming it) published with
  `./publish-runtime.sh dev`. Public dev manifest `wrapper_sha256` = local
  `27fcd294...`; stable untouched (`85ef00e1...`, = mpi-ci `07970da`).
- **App create on v2, CPU download mode**: `createPod REST -> http 201`, Pod `xnf6hdfgym9tiu`,
  EU-RO-1, `v0.23.0-dev-cpu`, dev runtime channel. `cpu3c` and `cpu3g` were refused with HTTP 400
  first, `cpu5c` took it. **Open question**: stock, or a v2 constraint on those flavours? The
  CPU fallback logs only the status; log `_createRejectReason(created.json)` there to know.
- **Watchdog**: Fabio quit the app without Disconnect; the Pod went to stopped by itself
  (console: paused, Not running, $0.00/hr, volume kept). The dev wrapper only calls
  `POST /v2/pods/{id}/action`, so the stop IS the v2 call. The Pod log line
  `self-stop issued (v2 action, HTTP ...)` was not read.

## Still owed

1. `./publish-runtime.sh promote` (Fabio's yes): ships this AND `77641aa` (MPI-756 reclaimBytes,
   dev-tested 2026-09-15, never promoted) to every user's Pod.
2. GPU create leg (the nested `gpu{}` body): Connect the cheapest GPU -> ready -> Disconnect ->
   Reconnect -> Disconnect; read `[runpod]` in `%APPDATA%/Cubric Studio/logs/app.log`.
3. The cpu3c/cpu3g 400s above.

## 2026-09-27 (session 3749bdc4)

- **CPU fallback now logs the reason**: the per-flavour warn reads
  `CPU flavor X refused (http N: <_createRejectReason>); retrying on Y`
  (`routes/remotePodLifecycle.js`). `pod-cpu-flavors` + `runpod-rest-v2` 19/19, eslint clean.
  The next CPU Connect's log answers the 400. Lead from the v2 spec: `cpu.vcpuCount` must be
  "valid for the selected CPU flavor", and the catalog example id is `cpu3c-2-4`, not `cpu3c`;
  `GET /v2/catalog/cpus` would settle it but needs a key (401 keyless).
- **Promote vs 1.5.x users, checked**: dev and stable manifests differ ONLY in `wrapper.py`
  (`start.sh` / `start-cpu.sh` sha identical). The wrapper diff `07970da..a5cf42a` is the v2
  self-stop plus MPI-756's additive `reclaimBytes` field and `.part`/`.hfstage` cleanup; no new
  import. v1.5.0 injects the user's key as `RUNPOD_API_KEY` exactly as now, and that key already
  stopped a Pod through v2 live. So a 1.5 Pod keeps self-stopping, and after 2026-11-15 it still
  can, where the stable wrapper's v1 call would not.
- **GPU leg, Fabio's app, 16:05-16:09Z** (RTX PRO 4500 Blackwell, EU-RO-1, vol `325olg030m`,
  Pod `41p752um23z3x3`, dev runtime): create -> ready in ~2m10s (v2 `GET /pods/{id}` reads drove
  the poll) -> Disconnect -> Reconnect `Pod resume kicked off` (v2 `POST .../action` start) ->
  Delete. `/runpod/pods` afterwards: 0 Pods, $0/hr (v2 list parsed; v2 DELETE worked).
  **Not exercised:** the REST v2 GPU create body. A RAM floor (Fabio's 15 GB; the default is 80,
  `js/core/storage.js`) routes every GPU create through GraphQL `podFindAndDeployOnDemand`, so the
  nested `gpu{}` body is only hit with the floor at 0. Stop and delete logged nothing on success,
  so the stop is inferred from the UI flow, not read: both now log `Pod stop|delete <id> -> http N`.
- **GraphQL retires too — "early 2027"** (docs.runpod.io/release-notes, read 2026-09-27). Three
  calls still use it (`routes/runpodRemote.js`): `gpuTypes` + `dataCenters` (the picker's
  catalogue, price, RAM, stock) and `createPodGraphql` (every RAM-floor create = every default
  user). v2 covers all three: `gpu.minRamPerGpu` (already sent by `_toV2PodSpec`), and
  `/v2/catalog/gpus` + `/v2/catalog/datacenters?include=GPU_AVAILABILITY`.
- **Fabio's call, same day**: the create moves in 2.0, the catalogue is a 2.1 blocker
  (MPI-894 phase 1b). Done here: `_createPodInternal` no longer branches to GraphQL on a RAM
  floor; the floor rides REST v2 as `gpu.minRamPerGpu`, and a refusal with a floor set still
  returns `ramFloorMissed`. Tests: `pod-cpu-flavors` (+ REST-not-GraphQL) and `runpod-rest-v2`
  (+ floor body) — 6 RunPod files 53/53, eslint clean. Doc: `docs/runpod-remote-engine.md`.
- **Runtime promoted** (Fabio's yes): `./publish-runtime.sh promote`, guard OK, stable
  manifest `wrapper_sha256` `27fcd294...` and the served `wrapper.py` hashes to it. Ships the
  v2 self-stop + MPI-756 reclaimBytes to every user's Pod.
- **First REST-floor Connect, 16:54Z** (RTX 4000 Ada, EU-RO-1, floors 45/45/30): the new path
  ran (`RAM floor NGB requested (v2 gpu.minRamPerGpu)`), RunPod answered v2 400 "There are no
  longer any instances available", and the toast said "No ≥30 GB host". Wrong: availability
  read at 16:55 had the card `available:false` (only RTX PRO 4000 Blackwell in stock). RunPod
  words both refusals the same, and the old GraphQL branch flagged every floor refusal too
  (MPI-160). Fixed: `ramFloorMissed` only when `_isGpuAvailable` says the card is in stock;
  test covers both. 6 RunPod files 54/54.
- **REST v2 GPU create PROVEN live, 17:04Z** (restarted app, auto-retry on, RTX 2000 Ada,
  EU-RO-1): after stock refusals, `createPod REST -> http 201 ok=true podId=vq1xasg8dhuibq` ->
  wrapper up (MpiNodes installed, ComfyUI restart 200) -> Delete `Pod delete vq1xasg8dhuibq ->
  http 204`. The Settings Connect before it sent the floor (`RAM floor 30GB requested (v2
  gpu.minRamPerGpu)`) and v2 answered the stock text, not a schema error, so the floor body
  validates; a 201 WITH a floor was not observed.
- **Found on that run, fixed**: the create that won came from `js/shell.js` (boot auto-connect
  AND the auto-retry wait), which never sent `minMemoryInGb` — every auto-retry placed with NO
  RAM floor (pre-existing since MPI-160; the 2026-09-05 L4 OOM is what the floor prevents).
  It now sends the floor exactly as Settings Connect does; both callers pass the full saved
  config. eslint clean.
- ~~Owed: one Connect on the restarted app~~ (done above) (the server loads the new create path only on
  restart) -> log shows `RAM floor NGB requested (v2 gpu.minRamPerGpu)` + `createPod REST ->
  http 201` -> Disconnect -> Delete.


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

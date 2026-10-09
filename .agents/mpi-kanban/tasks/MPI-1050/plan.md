# MPI-1050 - Pods miss the engine assets

## Root cause (proven from Fabio's app.log, 2026-10-09)

`js/shell.js` runs the two remote heals (`_healRemoteNodeDrift`, `_installRemoteEngineAssets`)
behind `_didFirstConnectDriftCheck`: ONCE per app session, not once per volume or Pod.

- 08:57:54Z first connect of the session: L4 Pod on the OLD volume `0gzc4yk344` (warm). Drift
  heal ran ("re-cloning 1 node(s)"), the asset install ran as a silent no-op, the latch set.
- 09:09Z Fabio switched to a NEW volume `lpja78wof3` (first appearance in any log). The CPU Pod
  never reached connected (no universal-nodes line) - the brief's "died with the CPU Pod"
  theory is wrong.
- 09:14Z GPU Pod `6mtshnzc61jz87` connected: the server-side universal-node install (per
  connect) fetched 6 missing nodes, so the volume was fresh - but both client heals were
  latched. The 4 engine assets never reached the new volume.
- The 08:58 "volume full: need 21.9 GB" block was a different install (all engine assets
  total ~6.5 GB).

## Fix

1. Drop the session latch: run both heals on every genuine connect edge (already debounced
   by `_wasRemoteConnected`, MPI-326). Both are no-ops on a healthy volume: no drifted node =
   early return; the asset install pre-checks the volume and credits what is there; an
   in-flight dep after a flap ATTACHES (MPI-97/MPI-481), a corpse re-installs.
2. One `[download]` log line per remote install: what it fetches vs what is already on the
   volume. Remote installs logged nothing, which is why this hid.
3. Guard: source-scan in `tests/remote-engine-assets.test.cjs`.
4. Docs: `docs/runpod-remote-engine.md`, `docs/download-manager.md`, `.claude/rules/comfy_engine.md`
   (Fabio approved the rules edit 2026-10-09).

Dropped from the brief: "log a failed silent job" - nothing failed here, and a failed silent
job already surfaces (toast / dialog in downloadService's download:failed handler).

## Verification

**Verify mode:** auto
- `node tests/remote-engine-assets.test.cjs`, `node --test tests/node-drift.test.cjs`,
  `node tests/install-queue-wedge.test.cjs` pass.
- Live (Fabio's next Pod, costs Pod time): a connect on a fresh volume lists
  `taef2_decoder.safetensors` under `/models/vae_approx` and logs the new `remote install
  engine:assets` line.

## Current State

Code, guard, docs and rules landed and verified (validation.md); uncommitted. Only the live
check remains: Fabio restarts the app, connects a Pod on `lpja78wof3`, and the log shows
`remote install engine:assets: fetching ...`, then taef2 under `/models/vae_approx`.

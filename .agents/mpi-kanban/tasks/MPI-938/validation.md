# MPI-938 — validation

The 1.6.1 -> 1.6.2 Windows delta is built and proven. Nothing was published: no tag, no
GitHub Release, no manifest mirrored into the repo.

## The artifact

| | |
|---|---|
| Bundle | `CubricStudio-windows-x64-update-v1.6.2.zip`, **125.0 MB** (125,039,956 bytes) |
| Built from | `c2f47ac8` (stamp `c4c63e46` + approval token), in the detached worktree `D:/tmp/cv-720` |
| Mode | build `updateBundleMode: delta` (manifest `artifact.kind: update-bundle`), `fromVersion 1.6.1` -> `toVersion 1.6.2`, 666 files, 18 deletes |
| Output | `D:\CubricStudio\Vision\Builds`, beside the full `CubricStudio-windows-x64-v1.6.2.zip` (538.7 MB) and `CubricStudio-v1.6.2-READ-ME-FIRST.md` |

Changelog copy approved by Fabio (2026-09-26); he wrote the token himself (the agent path is
classifier-blocked). The bundle is 43x the 1.6.1 one because this hop crosses the MPI-708
rename: the delta ships `CubricStudio.exe` (the Electron root) and retires `CubricVision.exe`.

## Pre-flight

- **Pod runtime:** `dev` and `stable` differ only by mpi-ci `77641aa` (`reclaimBytes` in
  `/wrapper/models/status`). The app reads it as `|| 0` (`routes/downloadManager.js`), so the
  released `stable` channel is safe. Same state 1.6.1 shipped against; no promote.
- **Engine:** `comfyui.core.tag` unchanged since `992a11c0`; only the MpiNodes pin moved
  (`b9f1d756`, 1.2.16), which the drift repair installs on first launch.
- **Master CI is red** on `9d6ef53d` (two stale `tests/desktop/agent-chat.spec.js` specs from
  MPI-867, which Fabio verified live). Not this card's; spun off as a separate task. The stamp
  commits are local until that red clears (pre-push refuses master while red).

## Evidence

- **`npm test` in the worktree at `c4c63e46`:** 1952 tests, 1951 pass, 0 fail, 1 skipped.
- **1.6.1 starting point is real:** the on-disk 1.6.1 stage hashes to the saved baseline
  (`CubricVision-windows-x64-v1.6.1.baseline-manifest.json`, `992a11c0c0b8`): 6935 wanted,
  0 missing, 0 wrong.
- **Manifest read from inside the zip:** `1.6.1 -> 1.6.2`, win32/x64, `update-bundle`, buildHash
  `c2f47ac800d2`; every manifest entry is in the zip; `package.json` 1.6.2, `APP_VERSION 1.6.2`,
  `SCHEMA_VERSION 4`, the `1.6.2` notes entry inside. **Zero deletes under a PRESERVE prefix.**
  Deletes: `CubricVision.exe` (RETIRED_PATHS), the Head Swap / DramaBox workflows and displays
  (MPI-781), three removed components, and the `cors` / `object-assign` packages.
- **Real apply, the tester's own path:** a copy of the pristine 1.6.1 stage ran ITS OWN
  `update-from-zip.bat` (1.6.1's applier, through the running `CubricVision.exe`): `Applied Cubric
  Vision update to 1.6.2`, exit 0. The running exe was evicted to `CubricVision.exe.old`, and the
  self-rewritten `.bat` finished cleanly. Patched tree vs the 1.6.2 full-stage manifest: 7170
  wanted, 0 missing, 1 wrong (`README.txt`, which update bundles never carry; it still names
  `CubricVision.exe`), 2 extra (`CubricVision.exe.old`, the install's own update-manifest).
- **DeepInfra + agent in the packaged tree:** with `CubricStudio.exe` as node, `routes/deepinfra.js`,
  `deepinfraCollage.js`, `agent.js`, `llm.js`, `systemCa.js`, `services/agentLoop.mjs` and `sharp`
  all load from the shipped `node_modules`. Only FLUX Schnell is `devOnly`.
- **Boot of the patched install** on port 47562 (own portable `user-data`, off-screen): server
  ready, served `APP_VERSION 1.6.2`, update check `up to date (current=1.6.2 latest=1.5.0)`,
  `/deepinfra/account` -> `NO_KEY` (no key in the sandbox), `/llm/models` lists the DeepInfra
  agent models, `/agent/history` ok; no error in `app.log` beyond the known ESM reparse warning.
  Instance stopped by path.

## Not done

- No paid DeepInfra call and no agent turn with a real key: the agent may not type Fabio's live
  key. The tester's first cloud run is that check.
- The engine was not installed in the sandbox, so the first-launch node-pack update was not run.

## Owed later

- The next hand-delivered build is 1.6.3; its baseline is saved as
  `D:\CubricStudio\Vision\Builds\CubricStudio-windows-x64-v1.6.2.baseline-manifest.json`
  (`portable-stage`, `c2f47ac800d2`, 7170 files).
- `CubricVision.exe.old` is never swept (the applier sweeps only `<target>.old` of a file it
  writes again), and an updated install's `README.txt` keeps naming `CubricVision.exe`. Both
  matter at 2.1, when MPI-708 decision (c) retires the old exe for the public fleet.

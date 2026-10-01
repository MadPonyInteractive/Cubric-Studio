# MPI-1010 — validation

The 1.6.2 -> 1.6.3 Windows delta is built and proven. Nothing was published: no tag, no
GitHub Release, no manifest mirrored into the repo.

## Why this build

Fabio installed the 1.6.2 portable on 2026-10-01 ("Remote only" + a DeepInfra key) and found
it very unresponsive. Two causes, both fixed on master after 1.6.2 was cut (2026-09-26):

- The landing project list used each project's newest ORIGINAL as its thumbnail. One 16K PNG
  (369 MB encoded) decoded for 2.3-2.6 s on a raster worker while the main thread sat in
  `LayerTreeHost::WaitForCommitCompletion`, on every grid build (CDP trace of the shipped
  build). MPI-963 (`b7fee8b7c`) serves the sidecar `.thumb.webp`.
- With "Skip the local engine install" and no Pod, every project click hit the no-engine gate,
  showed the warning and REBUILT the grid, re-running that decode. MPI-856 (`d5a783ce7`) lets a
  project open with no engine.

## The artifact

| | |
|---|---|
| Bundle | `CubricStudio-windows-x64-update-v1.6.3.zip`, **100.3 MB** (100,278,398 bytes) |
| Built from | `8e93f72ae` (stamp + notes + Fabio's approval token, one commit), in the detached worktree `D:/tmp/cv-720` |
| Mode | `updateBundleMode: delta` (manifest `artifact.kind: update-bundle`), `fromVersion 1.6.2` -> `toVersion 1.6.3`, 288 files, 4 deletes |
| Output | `D:\CubricStudio\Vision\Builds`, beside the full `CubricStudio-windows-x64-v1.6.3.zip` (539.1 MB), the 1.6.3 baseline and `CubricStudio-v1.6.3-READ-ME-FIRST.md` |

The delta carries `CubricStudio.exe` (222 MB uncompressed) although Electron did not move
(lock deps unchanged): the exe's version resource is stamped per version.

## Evidence

- **`npm test` in the worktree at `8e93f72ae`:** 2633 tests, 2631 pass, 0 fail, 2 skipped.
- **Master CI:** `Tests` success on `5a8dc2d2a` (MPI-513's installStore commit, which this build
  carries) and on `745e75f7a`. The commits between are board/docs only.
- **1.6.2 starting point is real:** the Builds 1.6.2 stage hashes to its saved baseline
  (`c2f47ac800d2`): 7170 wanted, 0 missing, 0 wrong (1 extra: the install's own update-manifest).
- **Manifest read from inside the zip:** `1.6.2 -> 1.6.3`, win32/x64, `update-bundle`, buildHash
  `8e93f72ae412`; `APP_VERSION 1.6.3`, `SCHEMA_VERSION 4` (unchanged), the `1.6.3` notes entry
  inside. **Zero deletes under a PRESERVE prefix**; the 4 deletes are the old
  `resources/app/mcp/listing/` plugin files.
- **Real apply, the tester's own path:** a copy of the pristine 1.6.2 stage ran ITS OWN
  `update-from-zip.bat` (through its running `CubricStudio.exe`): `Applied Cubric Studio update to
  1.6.3`, exit 0. Patched tree vs the 1.6.3 full-stage manifest: **7213 wanted, 0 missing,
  0 wrong**; 248 extra = 244 rollback backups, `CubricStudio.exe.old`, the install's own
  update-manifest, and 2 pending launchers byte-identical to the live ones.
- **Boot of the patched install** on port 47563 (own portable `user-data`, own `APP_DOCUMENTS`,
  off-screen), twice: launcher heal installed both launchers on first start, served
  `APP_VERSION 1.6.3`, update check `up to date (current=1.6.3 latest=1.5.0)`,
  `/list-projects` -> `[]` (the scratch Documents held), `/deepinfra/account` -> `NO_KEY`. No
  error in `app.log` beyond the known ESM reparse warning. Instance stopped by path.

## Pre-flight (see checklist)

Engine core tag unchanged; node pins moved (MpiNodes, MelodramaBox; SplatKit dropped), applied by
the first-launch drift repair. Pod runtime `stable` = mpi-ci `a5cf42a` (0.2.44); `dev` adds
`b131c0a` + `57a31c0` (0.2.45), promote held to the 2.0 cut (MPI-894). The changelog therefore
leaves out Chatter Box on a Pod (needs `b131c0a`) and "Connect waits by default" (new installs
only).

## Not done

- No paid DeepInfra call and no generation on the patched build.
- The engine was not installed in the sandbox, so the first-launch node-pack update was not run.

## Owed later

- The next hand-delivered build is 1.6.4 (or 2.0); its baseline is
  `D:\CubricStudio\Vision\Builds\CubricStudio-windows-x64-v1.6.3.baseline-manifest.json`
  (`portable-stage`, `8e93f72ae412`, 7213 files).
- Once the tester is on 1.6.3, the 1.6.2 stage, full zip, update zip and note in Builds can go
  (Fabio cleared the 1.4.0-1.6.1 builds to the Recycle Bin on 2026-10-01).

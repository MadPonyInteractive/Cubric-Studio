# MPI-954 validation

Commit `37e5eca77` (2026-09-27): one worker, then review. Fabio, 2026-09-27: fix the
1.x -> 2.0 hop on Linux/Mac, don't paper over it with a known-issue line.

## Root cause

The applier that runs an update is the one ALREADY installed. 1.5.0's writes every `files[]`
entry with `fs.copyFileSync`, which rewrites the destination's same inode. `update.sh` and
`update-from-zip.sh` (the macOS `.command` twins too, and on Windows `update-from-zip.bat`, which
cmd also re-reads by byte offset) were in `files[]`, so the shell running them resumed mid-file:
exit 127 on dash, measured on the Linux box 2026-09-18 (MPI-708 `validation.md` § MPI-595
Gate A). The `main()` wrap (`d2379a38f`) only protects hops that START from a wrapped launcher.

## Fix

- `stageUpdateBundle` stages every launcher under `update/pending-launchers/`, never at the
  bundle root, on all three platforms. The installed applier never touches the running script.
- `main/launcherHeal.cjs`, called from `main.js` at boot, moves them to the portable root with
  `renameSync` (a new inode) and re-asserts +x. Non-fatal and retried next boot.
- The 1.5.0 launchers keep working until then: their start chain launches 2.0 through the same
  `app/` + `node_modules/electron/dist/...` paths (checked against `git show v1.5.0:`).
- A delta against a 1.5.0 baseline cannot delete the root launchers: they are outside the
  bundle's path scope (`applyDelta` scopes deletes to the roots the bundle ships).
- The 2.0 applier writes temp + `renameSync` on POSIX (`copyFileToTarget`), so later hops are
  fixed at the root and not only by the wrap.

## Evidence (agent-verified)

- `tests/portable-launcher-heal.test.cjs`: the installed-style applier leaves root launchers
  alone; the REAL heal module installs + keeps +x + removes the dir; full round-trip; the REAL
  `stageUpdateBundle` ships launchers only under `update/pending-launchers/`; a delta vs a
  1.5.0-style baseline never deletes a root launcher. The builder test was mutation-checked
  (launchers put back at the root -> red). Review replaced two test-local copies of the heal
  logic with the real module.
- `node --test tests/portable-*.test.cjs` 21 pass / 1 skipped; `npm test` 2134 / 0 / 2 skipped.

## Real-hardware proof — Linux box, 2026-09-27 (`ssh linuxbox`, /bin/sh -> /usr/bin/dash)

Three fresh extracts of the SHIPPED `CubricVision-linux-x64-v1.5.0.tar.gz`; in every leg the
INSTALLED 1.5.0 launchers and applier do the applying. Bundle built on Windows with the real
`stageUpdateBundle` from committed blobs (LF): payload = v1.5.0 `app/main.js` + the one heal line,
`main/launcherHeal.cjs`, master's applier and master's wrapped launchers. CONTROL = the same
bundle with the launchers moved back to the root and into files[] (the pre-fix shape).
Kit: `scratchpad/mpi954-bundle.mjs`, `ab954-manual.sh`, `ab954-inapp.sh` (copies on the box
under `~/mpi954/`).

| Leg | Path | Result |
|---|---|---|
| CONTROL | `./update-from-zip.sh <zip>` | applier OK, then `./update-from-zip.sh: 38: le: not found`, **exit 127** (the bug, reproduced) |
| NEW | `./update-from-zip.sh <zip>` | **exit 0**; all four root launchers md5-identical to before (untouched); `update/pending-launchers/` holds the four, all `-rwxr-xr-x` |
| NEW | `./update.sh` (in-app; only `update/fetch-release.cjs` stubbed to hand it the local zip) | **exit 0**, log ends `Update applied successfully.` / `Relaunching Cubric Vision...`, no `update-result.json` failure |
| NEW | the relaunched app's boot (DISPLAY=:0, console session) | within 2 s: `pending-launchers/` gone; all four root launchers now the wrapped 2.0 versions, +x; `user-data/logs/app.log`: `[update] launcher heal: installed` x4 at 11:43:12Z, one second after the apply |

**Not run: macOS** (no Mac on hand). Same mechanism (`.command` launchers, POSIX rename), same
code path in `stageUpdateBundle` and the heal module, unit-tested; the release smoke of a macOS
build is where it would show.

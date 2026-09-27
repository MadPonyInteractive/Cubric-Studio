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

## Still owed: the real-hardware proof (Linux box, Fabio turns it on)

The POSIX before/after (a shell reading a file replaced by copy vs by rename) is skipped on
Windows. On `ssh linuxbox`, with a real 2.0 update bundle built from this code:

1. `~/mpi595/mpi595-ab-kit/ab-selfrewrite.sh` against a fresh v1.5.0 install: exit 0, and
   `update/update-result.json` absent or `ok:true`.
2. `update/pending-launchers/` exists after apply; the first 2.0 boot empties and removes it.
3. The root `.sh` launchers are the 2.0 (wrapped) versions after boot, all +x.
4. The manual path, `./update-from-zip.sh <bundle>`, exits 0 as well.

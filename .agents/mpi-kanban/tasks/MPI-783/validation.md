# MPI-783 — validation

A portable `--dry-run` can no longer write anything a real build owns.

## Root cause

`--dry-run` copies no app files, so its output is never an artifact. `main()` already knew
that (the release-notes approval gate skips dry-runs for exactly that reason), but every
OUTPUT was shared with a real build: the stage root name
`CubricVision-<label>-<arch>-v<ver>` in the same default stage dir
(`D:\CubricStudio\Vision\Builds`), the update root `CubricVision-v<ver>-update-only`, the
shipped archive names, and the mirror over the tracked
`resources/cubric/update-manifest.json`. `npm run build:portable:dry-run` passes nothing
else, so the plain command hit all four. The 2026-09-12 run from `aabc9898` did: it rewrote
the delivered 1.6.0 stage in place, re-hashed it into a `dry-run-stage` manifest, replaced
both 1.6.0 zips under their real names (the 15.5 MB delta became a 519 MB full bundle), and
mirrored that manifest over the tracked file. That mirror is still the 34k-line
`M resources/cubric/update-manifest.json` in the working tree (its `createdAt`,
`2026-09-12T10:15:05.995Z`, matches the stage manifest exactly).

## The fix (`scripts/build-portable.mjs`)

- `parseArgs`: `--dry-run` forces `archive = false` and `sourceManifest = false`. No flag
  re-enables either, so argument order does not matter.
- `main`: both stage roots get a `-dry-run` suffix, so no `--stage-dir` can place a dry-run
  on top of a real build. `--clean` in a dry-run can therefore only remove a dry-run root.
- Real builds are unchanged: the suffix is empty and both flags keep their defaults.
- `parseArgs` is exported for the test. Help text and
  `docs/releases/portable-distribution-contract.md` § Local dev builds say all of this.

Consumers swept: `build:portable:dry-run` (package.json), `scripts/build-portable.ps1`
(passes `--dry-run` through), the mpi-ci workflows (no dry-run use), the tests (none used it).
The npm scripts for real builds never pass `--dry-run`.

## Evidence

- **`tests/portable-dry-run-isolation.test.cjs`, run against the UNFIXED script first:** both
  tests fail: `dry-run rewrote real output CubricVision-windows-x64-update-v1.6.1.zip` and
  `parseArgs is not a function`. With the fix: 2/2 pass, and the run drops from 14.4 s to
  2.4 s because nothing is archived.
  - Test 1 spawns a real `--dry-run --platform win32 --stage-dir <tmp>` over sentinel files
    under every real-build name (stage manifest, launcher, update-only root, both zips) and
    asserts all of them are byte-identical afterwards, no archive was written, every new file
    sits under a `-dry-run` root, and that root's manifest reads `dry-run-stage`. It passes
    `--no-source-manifest` itself, so a regression can never dirty the repo's tracked file.
  - Test 2 pins the parsed options: dry-run means no archive and no mirror; a plain run keeps both.
- The tracked manifest's mtime is still `2026-09-12 11:15:06` after both test runs.
- **`npm test`:** 1216 tests, 1215 pass, 0 fail, 1 skipped.

## Not done

- `resources/cubric/update-manifest.json` is left dirty. Restoring it discards a
  working-tree change, which is Fabio's call: `git restore resources/cubric/update-manifest.json`.
- `npm run build:portable:dry-run` was not run against the real `Builds` folder. The test
  covers the same code path in a temp dir, without leaving a `-dry-run` folder in the
  distribution folder.

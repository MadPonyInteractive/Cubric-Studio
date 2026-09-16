# MPI-782 — validation

The 1.6.0 -> 1.6.1 Windows delta is built and proven. Nothing was published: no tag, no
GitHub Release, no manifest mirrored into the repo.

## The artifact

| | |
|---|---|
| Bundle | `CubricVision-windows-x64-update-v1.6.1.zip`, **2.9 MB** (2,900,725 bytes) |
| Built from | `992a11c0` (master HEAD + the stamp), in the detached worktree `D:/tmp/cv-720` |
| Mode | `delta`, `fromVersion 1.6.0` -> `toVersion 1.6.1`, 281 files, 25 deletes |
| Output | `D:\CubricStudio\Vision\Builds`, beside the full `CubricVision-windows-x64-v1.6.1.zip` (518.8 MB) and `CubricVision-v1.6.1-READ-ME-FIRST.md` |

Stamp commit `992a11c0`: version triple, `RELEASE_NOTES['1.6.1']`, `.approved-1.6.1.json`.
Fabio waived the changelog copy gate (2026-09-16); the token was written with `--yes`.

## The trap this card hit: the 1.6.0 baseline on disk was not 1.6.0

The 1.6.0 stage folder and both 1.6.0 zips in `Builds` are dated 2026-09-12, not the 09-11
handover. A **dry-run** from master `aabc9898` ran over the old stage folder without
`--clean`: a dry-run copies no app files (`stagePortableSkeleton` returns early), but it
rewrites the skeleton (launchers, `update/*`, `README.txt`), `buildInfo.js`, adds
`PORTABLE_DRY_RUN.txt`, re-hashes the folder and re-zips it. The result is labelled
`dry-run-stage`, buildHash `aabc98983404`, and it also replaced the 15.5 MB delta the
tester actually received with a 519 MB full bundle of the same name.

Used as a baseline, that manifest would have recorded `aabc9898`'s `update/*` hashes as
"what the tester has". So a dry-run also cannot regenerate a baseline. Instead the 1.6.0
stage was **rebuilt for real** at `df2400bf` (`--no-update-bundle --no-archive` into
`D:/tmp/cv161-base`) while the worktree still sat there. Compared with the contaminated
manifest: 0 files only in the rebuild; 1 only in the old one (`PORTABLE_DRY_RUN.txt`); 9
hash differences, all of them the dry-run's own rewrites. Every other app file matched,
so the rebuild reproduces the shipped 1.6.0.

## Evidence

- **`npm test` in the worktree at `992a11c0`:** 1192 tests, 1191 pass, 0 fail, 1 skipped.
- **Manifest read from inside the zip:** `1.6.0 -> 1.6.1`, win32/x64, kind `update-bundle`,
  buildHash `992a11c0c0b8`; every manifest entry is present in the zip; `package.json` 1.6.1,
  `APP_VERSION 1.6.1`, `SCHEMA_VERSION 4`, the `1.6.1` notes entry inside.
- **Zero deletes under a PRESERVE prefix.** All 25 are under `resources/app/`: tier moves
  (MpiFlowLibrary, MpiModelManager, MpiRunpodSettings, MpiCompareOverlay, MpiProjectCard,
  MpiBaseFlow, MpiMaskedImagePreview), the old MpiVideoControlBar, the retired
  `nvidia_pid_*` workflows and `hero-bg.jpeg`. None exists at `992a11c0`, and every
  remaining reference points at the new location.
- **Git cross-check:** of 875 files added/modified/renamed between `df2400bf` and `992a11c0`,
  every one outside `APP_COPY_EXCLUDES` is in the delta (0 missing).
- **Real apply, the tester's own path:** `update-from-zip.bat` from the rebuilt 1.6.0 stage
  (bundled `CubricVision.exe` as node, i.e. the 1.6.0 applier) printed
  `Applied Cubric Vision update to 1.6.1`, exit 0. The patched tree, hashed file by file
  (engine/models/user-data/rollback skipped), matches the 1.6.1 full-stage manifest
  exactly: 6935 wanted, 0 missing, 0 wrong. The single extra file is
  `resources/cubric/update-manifest.json`, which by design is not in its own list. It now
  reads `toVersion 1.6.1`.
- Engine pins (`node_lock.json`, `system_dependencies.json`) unchanged since `df2400bf`, so the
  first launch installs nothing new.

## Not done

- The patched app was not launched. The build is byte-identical to the full 1.6.1 stage,
  so a launch would test master's boot, which Fabio accepted as is.
- Handover is Fabio's: send the zip and the note.

## Owed later

The 2.0 release still owes a FULL bundle (`fromVersion: null`), per MPI-722, because the
1.5.0 -> 2.0.0 delta will refuse a 1.6.x install. The next hand-delivered build is 1.6.2,
and its baseline is saved as
`D:\CubricStudio\Vision\Builds\CubricVision-windows-x64-v1.6.1.baseline-manifest.json`
(`portable-stage`, `992a11c0c0b8`, 6935 files). Use that copy, not the stage folder: any
dry-run with the default stage dir writes into the stage folder the same way.

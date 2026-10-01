# MPI-1010 — checklist

Not a release: no tag, no GitHub Release, no `update-manifest.json` publish. One Windows
update-only bundle for the tester on 1.6.2 (Fabio, 2026-10-01: "you may cut a 1.6.3 update").
Same shape as MPI-938.

Why now: 1.6.2 froze the landing for 2.3-2.6 s per project-list build when a project's newest
card was a 16K PNG (the card loaded the 369 MB original; MPI-963 shows the thumb), and a
"Remote only" install with no Pod could not open a project at all (MPI-856). Both landed after
1.6.2 was cut.

- [x] Pre-flight: master CI green (`Tests` success on `745e75f7a`; `30d542416` is docs-only)
- [x] Pre-flight: engine core tag unchanged since 1.6.2; node pins moved (MpiNodes `bc92a1b`,
      MelodramaBox `529c4be`, SplatKit removed), installed by the first-launch drift repair
- [x] Pre-flight: Pod runtime `stable` = mpi-ci `a5cf42a` (0.2.44), `dev` adds `b131c0a` +
      `57a31c0` (0.2.45). Promote held to the 2.0 cut (Fabio 2026-09-29, MPI-894); master's app
      stays lazy on a wrapper that cannot queue, so 1.6.3 on `stable` regresses nothing
- [x] Stamp master 1.6.3: `appVersion.js`, `package.json`, `package-lock.json`
- [x] `RELEASE_NOTES['1.6.3']`; Fabio approved the copy and wrote `.approved-1.6.3.json`
      (UNRELEASED.md untouched: all of it still belongs to 2.0, Fabio 2026-10-01)
- [x] Commit those five files by pathspec on master (`8e93f72ae`)
- [x] Move `D:/tmp/cv-720` to that commit (lock deps unchanged since 1.6.2), `npm test`:
      2633 tests, 2631 pass, 0 fail, 2 skipped
- [x] Build with `--clean --platform win32 --arch x64 --from-manifest <1.6.2 baseline> --no-source-manifest`
- [x] Read the manifest out of the zip: `fromVersion 1.6.2`, `toVersion 1.6.3`, no delete
      under a PRESERVE prefix, stamp and build hash inside
- [x] Real apply over a pristine 1.6.2 stage with ITS OWN `update-from-zip.bat`; patched
      tree matches the 1.6.3 full stage (7213 / 0 missing / 0 wrong)
- [x] Boot the patched install off-screen: serves 1.6.3, no new error in `app.log`
- [x] Save the 1.6.3 baseline manifest + handover note beside the zip
- [x] CI green on the pushed commits: `Tests` #1442 success on `28833e5a2` (stamp `8e93f72ae` under it)

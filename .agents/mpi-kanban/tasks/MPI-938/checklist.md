# MPI-938 — checklist

Not a release: no tag, no GitHub Release, no `update-manifest.json` publish. One Windows
update-only bundle for the photographer tester on 1.6.1 (Fabio, 2026-09-26: "cut a private
release, 1.6.2"). Same shape as MPI-782.

- [x] Pre-flight: Pod runtime `dev` vs `stable` (one dev-only wrapper commit, `reclaimBytes`,
      read as `|| 0` by the app — stable is safe); engine core tag unchanged since 1.6.1
      (only the MpiNodes pin moved)
- [x] Stamp master 1.6.2: `appVersion.js`, `package.json`, `package-lock.json`
- [x] `RELEASE_NOTES['1.6.2']` + `.approved-1.6.2.json` (the build refuses without both)
- [x] Commit those five files by pathspec on master
- [x] Move `D:/tmp/cv-720` to that commit, install deps if the lock moved, `npm test`
- [x] Build with `--from-manifest <1.6.1 baseline> --no-source-manifest`
- [x] Read the manifest out of the zip: `fromVersion 1.6.1`, `toVersion 1.6.2`, no delete
      under a PRESERVE prefix, stamp and build hash inside
- [x] Real apply over a pristine 1.6.1 stage with ITS OWN `update-from-zip.bat`; patched
      tree matches the 1.6.2 full stage (this hop crosses the CubricVision -> CubricStudio
      exe rename, MPI-708)
- [x] Handover note beside the zip

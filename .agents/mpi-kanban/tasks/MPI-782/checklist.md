# MPI-782 — checklist

Not a release: no tag, no GitHub Release, no `update-manifest.json` publish. One Windows
update-only bundle for one person on 1.6.0 (Fabio, 2026-09-16: cut from master as is, no
copy gate, no cherry-pick; he tells the tester what is finished and what is not).

- [x] Regenerate the 1.6.0 baseline from `D:/tmp/cv-720` while it still sits at `df2400bf`
      (the on-disk 1.6.0 stage was overwritten by a later dry-run with another build hash)
- [x] Stamp master 1.6.1: `appVersion.js`, `package.json`, `package-lock.json`
- [x] `RELEASE_NOTES['1.6.1']` + `.approved-1.6.1.json` (the build refuses without both)
- [x] Commit those five files by pathspec on master
- [x] Move `D:/tmp/cv-720` to that commit, install deps if the lock moved, `npm test`
- [x] Build with `--from-manifest <1.6.0 baseline> --no-source-manifest`
- [x] Read the manifest out of the zip: `fromVersion 1.6.0`, `toVersion 1.6.1`, no delete
      under a PRESERVE prefix, stamp and build hash inside
- [x] Handover note beside the zip

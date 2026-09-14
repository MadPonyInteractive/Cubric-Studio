# MPI-752 checklist

- [x] Offline probe: remote gate blocks at 46.3GB when the status pre-check fails, starts when it succeeds (same volume, 30GB free)
- [x] Remote gate counts only bytes known to be missing (unknown install state and requirements-only node re-runs add nothing)
- [x] Local twin reviewed: its install state comes from a disk stat, no unknown arm
- [x] Test: tests/remote-disk-gate-unknown-state.test.cjs - failed 3 of 5 before the fix (short answer 46.3GB, pip re-run 41.5GB), 5 of 5 after
- [x] Model panel Disk row: "[X on disk · ]Y to download" whenever anything is left, to-download figure in --ink-1 (eslint clean)
- [x] Docs: download-manager.md remote pre-flight, model-library.md disk row + never-sum note for MPI-755
- [x] Release note in UNRELEASED.md Fixes
- [x] npm test green (977/977)
- [x] User check: Krea 2 NSFW panel reads 12.1GB on disk · 12.3GB to download (matches G: on-disk measurement); colour approved
- [x] User check: LTX 2.3 High refused locally at 60.7GB needed / 30.3GB free (local gate unchanged, positive control)

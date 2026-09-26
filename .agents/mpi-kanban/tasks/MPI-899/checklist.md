# MPI-899 checklist

- [x] Reproduce: badge reads a batch count the current model does not offer - NOT reproducible (see validation.md)
- [x] Root cause named - not found; leading theory (a throw mid-switch leaving stale controls) recorded
- [x] Fix at the root - diagnosability only: renderer throws now reach app.log with their stack (ac470d96, 5ddc62be)
- [x] Regression test - tests/desktop/prompt-box-badge.spec.js (error bridge + badge probe)
- [x] Fabio: close as can't repro (2026-09-26)

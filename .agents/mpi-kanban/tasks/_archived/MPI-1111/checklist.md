# MPI-1111 Checklist

- [x] Root cause: `_buildRunSlide` rebuilds the frame on every navigation; nothing re-armed the scanline or reseeded the held latent while `_running`.
- [x] Fix: `_buildRunSlide` re-arms `_setScanline(true)`, `_syncResultEmpty()`, and repaints `activeGenerations.getLastPreview` when `_running` (a440ec70f, pushed).
- [x] Source contract in `tests/flow-cue-stacks.test.cjs` (fails on the pre-fix file); `node --test tests/flow-*.test.cjs` 234/234; eslint clean.
- [x] Fabio eye test (passed 2026-10-12): start a Flow run, step back to Inputs, return to Generate - the scanline sweeps and the last latent shows at once, not "Your result appears here."

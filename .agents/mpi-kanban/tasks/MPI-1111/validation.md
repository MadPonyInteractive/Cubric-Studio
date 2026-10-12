# MPI-1111 Validation

- `node --test tests/flow-*.test.cjs`: 234/234 pass. The new MPI-1111 contract in `tests/flow-cue-stacks.test.cjs` fails against the pre-fix file (HEAD before a440ec70f).
- eslint clean on `MpiBaseFlow.js` and the test.
- Fabio eye test, 2026-10-12, 360 Panorama: stepped away from Generate mid-run and back; the scanline and the latent both stayed. Passed.

# MPI-743 checklist

Fabio 2026-09-30 (via MPI-595): a 2.0 gate. His call on the open question: **no message on a
deliberate Cancel; a message only when the install actually fails.**

- [x] Re-read the paths under that call: Cancel is already silent; a failed `verify` probe keeps
  `MpiLicenceGate` open with its error (`MpiLicenceGate.js:225`); a failed download already
  reaches the user through `download:failed`. So `start()` returning `false` has no consumer
  and is not built.
- [x] `_installMissing` comment records the decision instead of "the fix is one line, not taken"
- [x] Noticed item folded in: a drawer model pick refreshes the grid tile too (`_patchTile`),
  not only the drawer (the tile read `Ready` after picking H3 until the library reopened)
- [x] Source test in `tests/flow-model-choice.test.cjs`; `npm test` on it
- [x] Seen in the isolated app with MPI-742

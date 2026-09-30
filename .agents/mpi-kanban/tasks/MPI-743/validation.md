# MPI-743 validation

Fabio 2026-09-30: no message on a deliberate Cancel; a message only when the install fails.

- Both failure paths already speak: a failed `verify` probe keeps `MpiLicenceGate` open with its
  error (`MpiLicenceGate.js` accept handler); a failed download emits `download:failed`. So no
  `start()` return-value change: nothing would consume it. The `_installMissing` comment now
  records the decision.
- Folded in (brief § Noticed): the drawer model pick calls `_patchTile(flow.id)` (chip + thumb +
  drawer), not `openDetail` alone.
- `tests/flow-model-choice.test.cjs`: new assert fails on HEAD's source, passes now. All three
  suites reading `MpiFlowLibrary.js`: 42/42 pass. ESLint clean on the file.
- Running app (see `tasks/MPI-742/validation.md`): pick H3 → tile `LICENCE REQUIRED` at once;
  Cancel on the gate → no toast, no job, tile unchanged.
- [x] Fabio's eyes, 2026-09-30: "Yeah, it looks good." He also opened the H3 gate himself in the pane; the instance was stopped before any install

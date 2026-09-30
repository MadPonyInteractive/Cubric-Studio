# MPI-992 validation

**Verified 2026-09-30. Fix commit `a4cd4580e`.**

- `tests/desktop/flow-library-skips-drawer.spec.js` - new History case: an installed flow picked
  with `currentPage = group-history` emits `flow:open` and does NOT open the drawer. Gallery and
  Landing cases unchanged. Passed locally in the fixing session (no artifact kept); the CI run
  below is the durable proof.
- `tests/flow-model-choice.test.cjs` - 24/24 pass; pins `_inProject()` as Gallery OR History.
- CI `Tests` on `a4cd4580e`: success (run 36578608058).

Product call (Fabio, 2026-09-30): the Library's `← Gallery` chip stays hidden when opened from
History - the X already returns to History, and a "Gallery" label there would lie. Left as is.

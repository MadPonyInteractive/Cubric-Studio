# MPI-1287 validation

- 2026-10-25 Fixed by LTX 2.5 model 18 in e7593e3e6: the slot-restore loop moved into `restoreSlotItems`
  (js/utils/declaredFields.js); a saved item with another group's role is skipped, only a role-less item falls back
  to position. Test: tests/flow-describe.test.cjs 'restoreSlotItems: a picture goes back to its own slot, never into
  another group by position (MPI-1287)' - fails without the fix (the peer's report). Pre-push lint + tests green.
- 2026-10-25 Live check (Flux 3 on flows 27, isolated app on the fixed tree): Multi-angle reopened with only the person
  picture saved - the outfit slot stays empty (before the fix the person showed in both slots).

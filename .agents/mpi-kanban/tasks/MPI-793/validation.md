# MPI-793 validation

A doc-only change: seven lines added under trap 5 in `docs/testing-desktop-specs.md`, which is
now 197 lines, inside the 200-line budget. Every claim in them comes from MPI-789's own
evidence (`tasks/MPI-789/validation.md`):

- The 1.5s delay run stayed green (1 passed, 4.5s).
- The held-reply run failed with `9 × locator resolved to 0 elements`, the same text as CI run
  35150684500.
- The kept request-count guard failed with `Expected: 1, Received: 2` when the fix was reverted.

No code changed, so no test run is needed.

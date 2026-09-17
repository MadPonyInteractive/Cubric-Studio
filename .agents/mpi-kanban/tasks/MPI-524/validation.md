# MPI-524 validation

**2026-09-17 - closed on an existing commit, Fabio's call ("close MPI-524").**

Commit 2ce60ea5 (2026-09-05, "fix: RAM floor to 80, and the smoke runner leads with a 5090")
replaced the stale "cheapest-first by measured availability" comment. Re-read today:

- `scripts/smoke-workflows.mjs:42-46`: GPU_ORDER leads with `RTX 5090` and the comment says why
  (L4 hosts measure 54 GB, 3090/4090 hosts 30/31, so none meets the floor).
- `scripts/smoke-workflows.mjs:82`: `MIN_RAM_GB = 80`, with the H3 OOM evidence beside it.

The floor was re-measured, not lowered blind, as the card required. Nothing left to build.

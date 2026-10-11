# MPI-1085 validation

- Fix: `456a4664b` - MpiStartingComfy backdrop/wrapper take the `--main-overlay-z` + 20 floor (same as MpiModal).
- `node --check` + eslint clean.
- CI: Tests green on `456a4664b`.
- Eye test (Fabio, 2026-10-11): with a Flow open, the engine-starting overlay dims the whole screen including the Flow. PASS.

# MPI-740 Validation

## Fix (2026-10-11, MPI-623 session 38 batch worker)

- Root cause: no wheel handler, so the range input stepped by `step` (0.1 dB) with the detent still on: crawl, and a 1 dB snap swallowed every tick at unity.
- Fix per brief: explicit wheel policy (`wheel`, dB `wheelStep` default 1), `preventDefault`, `detent = false` on wheel like keydown; the four `on()` unsubscribes stored and released by a new `el.destroy()`. Props documented in `types.js`.
- `node --test tests/mpi-fader-wheel.test.cjs`: 11 pass / 0 fail (re-run by the orchestrator). `npx eslint js/components/Primitives/MpiFader`: clean.
- **Left: Fabio feel-test (user-ux)** on the components page: from 0 dB one wheel tick up = +1.0 dB, down = -1.0 dB; a slow drag through unity still snaps; the `snap: 0` variant wheels the same.

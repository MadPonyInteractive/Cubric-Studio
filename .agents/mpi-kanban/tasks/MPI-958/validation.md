# MPI-958 validation

- `node --test tests/cloud-executor.test.cjs`: 35/35. The Stop-inside-the-window test now asserts ticks `[2, 0]`.
- `npm test`: 2176 pass, 0 fail.
- `tests/desktop/cue-send-countdown.spec.js`: green locally. With the CSS fix reverted it fails (button and fill both `oklch(0.76 0.17 355)`), so it guards the bug.
- CI: `c20987f73` red, spec timed out on the bare runner's "No models installed" dialog. Fixture fix `aa247d693` stubs klein-4b installed; run 36403167612 green.
- Fabio checked both fixes live, 2026-09-28.

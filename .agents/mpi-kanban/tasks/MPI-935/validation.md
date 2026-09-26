# MPI-935 validation

## 2026-09-26 - implementation

- `node --test tests/system-ca.test.cjs` -> pass 1 / fail 0. Child runs with
  `NODE_USE_SYSTEM_CA` + `NODE_OPTIONS` stripped. Negative control inside the test:
  before `trustSystemCa()` the default set does NOT hold every system cert (so the probe
  is not vacuous); after, it holds every system cert AND every prior default cert,
  compared by SHA-256 fingerprint (the store re-encodes PEMs it already holds, so string
  compare gave a false failure).
- Measured: Windows store lists 123 entries for 67 unique certs; bundled 144; after = 181.
- Gotcha: Fabio's shell sets `NODE_USE_SYSTEM_CA=1`, so on this machine plain `node` already
  trusts the store and the bug is invisible - verify with it unset.
- `npm run app:isolated` with `NODE_USE_SYSTEM_CA` unset -> READY on its own port: main.js
  and the forked server.js both boot past `trustSystemCa()` under Electron 41 (Node 24.14).
- eslint on the four files: clean.
- CI green on the code commit `c792794d` (Tests run 36223504102: unit + desktop 1-4).
- Claim auditor: 14 PROVEN, 0 FALSE (2 unproven = the boot/lint runs above, not re-runnable
  read-only).
- Not done: live handshake through an AV/mitmproxy root (needs a CA installed into the
  Windows user store - Fabio's call).

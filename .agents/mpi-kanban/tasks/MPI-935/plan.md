# MPI-935 - Trust the Windows certificate store in both Node processes

## Goal
Antivirus HTTPS scanning (root CA installed in the OS store) stops breaking model downloads
and the update check. Fix the primitive: which CA list each Node process trusts.

## Implementation
- `routes/systemCa.js`: `tls.setDefaultCACertificates([...default, ...system])` - `default`
  (not `bundled`) keeps `NODE_EXTRA_CA_CERTS`.
- Call it at the top of `server.js` (forked server: downloads, HEAD probes, HF/R2,
  DeepInfra, engine archive) AND `main.js` (Node `fetch` update check, `main.js` ~1264).
- MPI-427's transport classifier untouched: a genuinely bad cert still fails.

Ownership: routes/systemCa.js, server.js, main.js, tests/system-ca.test.cjs

## Verification
**Verify mode:** auto
- `tests/system-ca.test.cjs` runs a child with `NODE_USE_SYSTEM_CA` stripped (Fabio's shell
  sets it =1, which hides the bug): before = no system cert trusted, after = every system cert.
- `app:isolated` boots clean.

## Current State
Shipped in `c792794d`, CI green; card closed 2026-09-26.

## Completed
- `routes/systemCa.js` + calls in `server.js` and `main.js`; unit test; release note in
  `docs/releases/UNRELEASED.md` § Fixes.

## Remaining Work
- None. Live AV / mitmproxy check SKIPPED by Fabio's decision (2026-09-26): installing a
  test root CA on his machine is a real trust risk, and the unit test already proves the
  mechanism. Confirmation comes from testers with HTTPS-scanning AV on the next build. Do
  not re-raise; Windows Sandbox is the route if a live proof is ever wanted.

## Plan Drift
- 2026-09-26: brief scoped only `server.js`; `main.js` update check is the same bug, folded in.

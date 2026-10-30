# MPI-1351 validation

## Root cause

The spec, not the app. Its first `app.evaluate` ran right after `electron.launch`, and
launch() returns while `main.js` is still in its synchronous top-level load. A
`DEBUG=pw:protocol` probe shows the evaluate's `Runtime.callFunctionOn` (awaitPromise)
answered with `{"error":{"code":-32000,"message":"Promise was collected"}}` before any
`main.js` log line; Playwright's `rewriteError` (crExecutionContext.js) turns any such
inspector error into "Execution context was destroyed, most likely because of a
navigation." V8 holds that promise weakly and the evaluate is serviced from inside the
long sync load, so a GC during the load collects it. Every later evaluate (200ms on)
succeeds, and a bare Electron app (empty main) never fails the first one.

Not a relaunch and not the single-instance lock: same main pid throughout (the
`app.process().pid` mismatch is Playwright's `shell: true` cmd.exe wrapper on Windows).

## Fix

The hold moved to a main-process preload, `tests/desktop/holdLandingReady.cjs`, loaded
with `electron -r` (Electron's default_app `--require`), so it is installed before
`main.js` runs and nothing races it. Trap 8 in `docs/testing-desktop-specs.md`.

## Evidence

- Spec 3 runs in a row: passed 11.0s / 9.8s / 9.2s; its `__heldLandingReady === 1`
  assertion proves the preload's hold is live.
- `npm run lint` green; `npm test` 3824 pass, 0 fail, 2 skipped.
- Full desktop suite: 251/252; ours green; the one red, cancelled-mascot.spec.js (expect.poll 1500ms on the mascot list), passed 3/3 alone with --repeat-each=3 and was green on the baseline run: a timing flake, not this change.
- CI run 40976385646 on a94877af0 (contains code commit 8d6100c73): unit + desktop shards 1-4 all success.

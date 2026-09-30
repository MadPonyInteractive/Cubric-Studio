# MPI-1001 validation

## Unit — PASSED 2026-09-30 (session a0ada438)

- `node --test tests/remote-ws-wedge.test.cjs` 5/5 on the fix: an OPEN socket with the ready flag
  down is replaced (the Pod-restart state), a handshake stuck past 10 s is dropped and replaced, a
  healthy handshake is waited on, a timeout logs readyState / ready flag / engine / channel and
  never the token, and connect()'s reuse rule needs the flag for an OPEN socket.
- The same file against HEAD's `comfyController.js` (before the fix): 4 of 5 FAIL — the stale
  OPEN socket and the stuck handshake both time out (`false` after 3 s), exactly the wedge.
- `npm test` 2425 pass, 0 fail, 2 skipped. ESLint clean.

## NOT verified

- A real Pod run: the fix is written without the renderer console (Fabio disconnected first), so
  which case hit him is not known. The new log lines say it: `Preview WS open but never ready —
  replacing it`, `Preview WS handshake stuck 10000 ms — replacing it`, or on a timeout
  `Preview WS not ready after 15000 ms: readyState …`. Fabio's test: connect a Pod, install a model
  on it (so its ComfyUI restarts), run; grep app.log for `Preview WS`.
- The tester's drops (his log not seen).

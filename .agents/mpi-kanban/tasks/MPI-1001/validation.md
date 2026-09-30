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

## Pod run 2026-09-30 (session cae496e5) — the trigger did NOT fire

- Pod `gj0tfzcctbdywj`, Fabio's restarted app: a masked Klein Edit ran clean (no `Still connecting`,
  no `Preview WS` line). But the model install before it did NOT restart the Pod's ComfyUI (app.log
  19:05:25Z `Model cache reseeded via /object_info (no restart needed)`), so the wedge path was not
  exercised.
- Why no install restarts it on his volume: the Pod reports `needs_comfy_restart` only when a
  custom_node lands (`wrapper.py` ~2512/2559 -> `downloadManager.js` ~2693); every model's nodes
  are universal now (scratch check: no model in `MODELS` has a non-universal custom node), and all
  10 are on his volume (`universal nodes: 10/10 already on volume`). The live trigger is now a
  node pin bump or a volume missing a node — not reproducible on demand from the UI.
- CI green on `e752180c3` (on top of the fix, `82f0dd612`).

## Closed 2026-09-30 on Fabio's word

"Yes, yes, you can close it" — on the unit evidence above (5/5 on the fix, 4/5 fail on the old
code) and the clean Pod run. Not seen live: which wedge case hit him, and whether the tester's
drops share this cause. The `Preview WS …` lines name the case the next time it fires.

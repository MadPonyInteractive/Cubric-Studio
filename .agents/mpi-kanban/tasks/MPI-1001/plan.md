# MPI-1001 plan

See brief.md for the evidence.

## Current State

2026-09-30 (session a0ada438): building the WS wedge fix in `comfyController.js` without the
renderer console (Fabio disconnected the Pod first). Root: the restart path drops `_wsReady` and
relies on connect() to "close the stale socket and re-handshake" (its own comment), but connect()'s
same-engine reuse branch (added later) kept any OPEN socket, and `ensureWsConnected` never called
connect() on an OPEN one, so OPEN + flag down had no exit. Fix: connect() reuses an OPEN socket only
while it is ready; `ensureWsConnected` also drops a handshake stuck over 10 s; a timeout logs the
socket state, so the next failure names its case in app.log. Unit-green (validation.md).
Next: Fabio tests in a fresh session (connect a Pod, install a model so the Pod's ComfyUI
restarts, run).

## Verification

**Verify mode:** user-ux (a real Pod run in Fabio's app; the RunPod key lives only in his profile).

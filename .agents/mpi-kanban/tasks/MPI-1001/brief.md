# MPI-1001 — remote runs wedge on "Still connecting to the remote engine"

**Breaks users.** Fabio 2026-09-30 in his dev app, and the photographer tester on 1.6.2 reports
Pods that "connect, then all of a sudden disconnect".

## Evidence (2026-09-30, session a0ada438)

- Pod `3j9el86ykarqpw`: NVIDIA L4, EU-RO-1, Secure Cloud catalogue (`cloud=SECURE`), wrapper
  0.2.45, dev runtime channel.
- 17:38Z Klein 9B installed on the Pod -> `state.remoteComfyNeedsRestart` (downloadService.js:830).
- 17:40:53Z the Pod's ComfyUI restarted (Pod `GET :8188/internal/logs/raw`: one `Starting server`).
- 17:41:08Z `kleinEdit` failed: `Still connecting to the remote engine` — the WS gate in
  `comfyController._ensureRemoteReady` (~:702), `ensureWsConnected({ timeoutMs: 15000 })` false.
- 17:43:32Z retry failed the same way, with NO restart in between.
- app.log has NO `WebSocket error (may be transient)` line and no `WS token fetch failed` line.
- ~17:44Z from this machine: a Node WebSocket to `wss://<pod>-8889.proxy.runpod.net/ws` and to
  `-8188/ws` opened in ~220 ms; `/health` = ready + comfy_ready; `/queue` empty. So the Pod and
  RunPod's proxy were fine: the renderer's socket state is what is wedged.
- The wrapper relay (`mpi-ci/cubric-vision-pod/wrapper/wrapper.py` `ws_relay`) closes the client
  socket when the upstream ComfyUI socket closes, so a restart alone should give a clean onclose.

## Candidates (not yet told apart — the renderer console decides)

1. An OPEN socket on the right engine with `_wsReady === false` (line ~663 sets it false before
   the restart; `connect()`'s same-engine reuse branch returns without re-flipping it, and
   `ensureWsConnected` never calls `connect()` on an OPEN socket). Needs a socket the restart did
   NOT close, e.g. a relay still inside `_build_loader_index()` (awaited after `accept()`, before
   the upstream connect).
2. A handshake stuck in CONNECTING that `ensureWsConnected` never replaces (it skips `connect()`
   while CONNECTING, and the reuse branch keeps it).

## The tester's drops — a second cause possible, not known

NOT the wrapper watchdog while the app is open: it resets on any authenticated call and
`MpiMemoryMonitor` polls `/wrapper/stats` every 2 s (docs/runpod-remote-engine.md, "Watchdog is a
crash backstop"). Needs his `<install>\user-data\logs\app.log`.

## Who has it

The reuse rule came in with 35fc264e7 (2026-07-15, "reuse WS only when bound engine matches"), so every
build since carries the wedge, the tester's 1.6.2 (c2f47ac8) included. Whether it is HIS drop is still
his log's to say.

## Next

Fix built and unit-green (plan.md, validation.md). Fabio's Pod test in a fresh session: connect,
install a model on the Pod (its ComfyUI restarts), run; app.log `Preview WS` lines name the case.
Then the tester's log.

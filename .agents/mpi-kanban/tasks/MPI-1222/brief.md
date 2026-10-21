# MPI-1222 - Dev radial Restart engine restarts NOW, even mid-generation

Asked by Fabio 2026-10-21 (session "Flux.3 integration 14"). His app's engine was starved of VRAM
by a second ComfyUI on the same GPU; a generation hung, he pressed the dev radial's Restart engine
and nothing happened: the restart only fires after the generation finishes.

## Today
Dev radial AND Settings both reach `_restartEngine()` in `js/shell/navigation.js` (~line 384,
`Events.on('engine:restart', ...)` at ~357). It probes `engine.waitForIdleQueue({ timeoutMs: 0,
unreachableMeansIdle: true })`; busy -> toast "Restart scheduled for when your generations finish
or are cancelled." and arms `_restartPending` (MPI-805, Fabio's call for the USER path; MPI-501
guards a running queue from losing work silently).

## Want (Fabio)
- Dev radial: restart right away, whatever is running. Cancel the in-flight work through the
  normal cancel path so the queue row ends visibly as cancelled (house rule: every end visible),
  then stop + start the engine (local) or `/proxy/restart-comfy` (remote).
- Settings / app-initiated restarts: unchanged (keep MPI-805's wait).

## Check
Find how the radial emits the restart (grep the radial action list) so only that caller forces.
Test: a long generation running, dev radial Restart -> the row shows cancelled, the engine
restarts within seconds, a new generation runs.

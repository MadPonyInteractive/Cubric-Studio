# MPI-1112 validation

Evidence (2026-10-12, Fabio's live log): local ComfyUI died mid flowTranscribe with
`Windows fatal exception: access violation` inside Qwen3-ASR (exit 3221225477). The renderer
retried the WS 6 times, `_onWsDropped` fired, showed the Pod OOM text and emitted
`remote:engine-dropped` -> `[remote] phase none -> disconnected (by engine drop)` + the second
Pod toast.

Fix: `onclose` records the dying socket's `_engine` on the first failed reopen;
`_onWsDropped` uses it - remote keeps the old text + event, local says "ComfyUI crashed, starts
again on your next generation" (true: `ensure` starts a not-running engine) and leaves the
remote connection alone.

- `node --test tests/comfy-ws-drop-local.test.cjs tests/engine-dropped-not-oom.test.cjs tests/comfy-vanished-prompt.test.cjs` -> 20 pass.
- eslint `js/services/comfyController.js` clean.
- NOT live-reproduced (needs a local ComfyUI crash mid-generation).

Left alone: `commandExecutor.js` logs "Remote engine dropped" and sets toast title "Remote
engine disconnected" for `engine_dropped` (file claimed by a peer; the toast shows no title).
The crash itself is MPI-1071's (Qwen3-ASR node).

# MPI-1326 validation

- Root cause: `_restartEngine` / `_restartEngineNow` (js/shell/navigation.js) chose the Pod from `isRemote()` alone. A download-only Pod is never the engine (`getEngine`) and has no ComfyUI, so `/wrapper/restart-comfy` answered 409 and the catch raised the "Restart failed" dialog.
- Fix: `_restartsPod()` = `isRemote() && !isDownloadOnly()`, used by both paths; the start toast tells a CPU-Pod user it restarted the local engine and why.
- `tests/restart-cpu-pod.test.cjs`: CPU Pod -> local, GPU Pod -> pod, no Pod -> local, both paths wired. Pass.
- `npm test`: 3796 tests, 0 fail. eslint on the touched files: clean.
- Not live-checked: needs a connected CPU Pod (billed). The next time one is connected, pressing Restart should show the toast and restart the local engine.

# MPI-1328 validation

- Root cause: the "installed" toast (js/shell/notificationService.js) chose the engine from `isRemote()`, so a model installed through a download-only Pod offered Restart engine for an engine that does not exist.
- Fix: the model-level `download:complete` carries the job's `engine` (routes/downloadManager.js `_broadcastModelComplete`); a remote install on a download-only Pod toasts only "<model> installed."; local installs and GPU Pod installs keep the offer.
- `tests/install-toast-restart.test.cjs`: CPU Pod = no button, GPU Pod = button, local install with a CPU Pod connected = button. Pass.
- `npm test`: 3799 tests, 0 fail. eslint on touched files clean. Code commit 993a131a0 pushed.
- Not live-checked: needs a billed CPU Pod.
- CI run 40802527219 on 993a131a0: success.

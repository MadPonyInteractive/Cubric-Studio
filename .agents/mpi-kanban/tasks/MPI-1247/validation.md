# MPI-1247 Validation

## What changed
- `js/shell/notificationService.js`: the in-app "installed" toast carries a **Restart engine**
  button (emits `engine:restart`, the Settings restart path, which waits for a busy queue)
  when the active engine's restart flag is set (`comfyNeedsRestart` local,
  `remoteComfyNeedsRestart` Pod). Weights-only installs need no restart (MPI-121 refreshes
  the model list), so their toast is unchanged.
- `routes/downloadManager.js`: the local node install now broadcasts `comfy:needs-restart`
  BEFORE the model-level `download:complete`, the order the Pod path already used, so the
  toast sees the flag.
- `js/shell/navigation.js`: `_performRestart` clears the matching flag after a successful
  restart. Before, Settings/radial restarts left it set and the next generation restarted
  the engine a second time.

## Evidence
- `tests/install-toast-restart.test.cjs` (new, 3 pass): button only with the flag set, the
  button emits `engine:restart`, broadcast order pinned, flag clear pinned.
- `tests/install-queue-wedge.test.cjs`: the "no `'engine:` literal" guard now exempts the
  `engine:restart` event name only.
- `npm test`: 3515 pass, 0 fail. `npm run lint`: clean.

## Not exercised
- No live install + restart in the app (needs a real node-bearing model download).
- Fast-disk staging on a Pod runs in the wrapper (`/remote/hot-store/ensure`), not in the
  ComfyUI process the restart cycles; not checked on a live Pod.

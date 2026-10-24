# MPI-1272 validation

## What changed

A local model install that adds custom nodes now sets `comfyNodesPending` (server `processState`, frontend `state`, `/comfy/status` `nodesPending`) instead of `comfyNeedsRestart`. The gen gate (`comfyController.js` `_readyOrRestartForNodes`) restarts ComfyUI only when the graph about to run uses a `class_type` the running engine has not registered (`/object_info/<class>` answers `{}`). Ten queued installs cost one restart, on the first run of a model that needs the new nodes.

`comfyNeedsRestart` keeps restart-before-every-run for the causes that need it: a Settings models-path change and the dynamic VRAM fault (MPI-1024). Every spawn, user restart and engine provision clears both flags.

## Evidence

- ComfyUI's route read in the bench source (`server.py` `get_object_info_node`): returns `{}` unless the class is in `NODE_CLASS_MAPPINGS`.
- `tests/restart-gate-node-classes.test.cjs`: the REAL gate methods lifted from source, run against a stubbed `/object_info`: loaded classes = no restart; missing class = restart; probe failure = restart; nothing pending or no graph = no probe. Wiring pinned by source; `nodesPending` read off a real `/comfy/status`.
- `npm run lint` exit 0, `npm test` 3579 pass / 0 fail; the pre-push hook re-ran both green on `65e90263` and `5a2ccfa8`, and CI (`tests.yml`) passed on `65e90263`.
- Claim audit at close-out: 0 FALSE. Its overstatements were fixed in `5a2ccfa8`: the changelog line says "on your computer" (the Pod still restarts before its next run), the downloads rule names the two graph-less callers, and three stale comments were corrected.

## Not covered

- No live run in the app. The isolated instance attaches to the user's shared engine on port 48188, so a restart test there would restart the user's engine. Remaining check: install a model with new nodes, keep generating on another model (no restart), then run the new one (one restart).
- Pod twin left as is on purpose: no model install reaches `remoteComfyNeedsRestart` now (`docs/runpod-remote-engine.md`), and the wrapper has no `/object_info` route.

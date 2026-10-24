# MPI-1272 validation

## What changed

A local model install that adds custom nodes now sets `comfyNodesPending` (server `processState`, frontend `state`, `/comfy/status` `nodesPending`) instead of `comfyNeedsRestart`. The gen gate (`comfyController.js` `_readyOrRestartForNodes`) restarts ComfyUI only when the graph about to run uses a `class_type` the running engine has not registered (`/object_info/<class>` answers `{}`). Ten queued installs cost one restart, on the first run of a model that needs the new nodes.

`comfyNeedsRestart` keeps restart-before-every-run for the causes that need it: a Settings models-path change and the dynamic VRAM fault (MPI-1024). Every spawn, user restart and engine provision clears both flags.

## Evidence

- ComfyUI's route read in the bench source (`server.py` `get_object_info_node`): returns `{}` unless the class is in `NODE_CLASS_MAPPINGS`.
- `tests/restart-gate-node-classes.test.cjs`: the REAL gate methods lifted from source, run against a stubbed `/object_info`: loaded classes = no restart; missing class = restart; probe failure = restart; nothing pending or no graph = no probe. Wiring pinned by source; `nodesPending` read off a real `/comfy/status`.
- `npm run lint` exit 0, `npm test` 3579 pass / 0 fail; the pre-push hook re-ran both green on `65e90263` and `5a2ccfa8`, and CI (`tests.yml`) passed on `65e90263`.
- Claim audit at close-out: 0 FALSE. Its overstatements were fixed in `5a2ccfa8`: the changelog line says "on your computer" (the Pod still restarts before its next run), the downloads rule names the two graph-less callers, and three stale comments were corrected.

- Live, Fabio's app, 2026-10-24: installed FLUX.2 Klein 4B while generating. `app.log` 18:07:53 `_runCustomNodeInstall: extracting 7 custom node(s) for model klein-4b` (all already on the engine, the MPI-222 universal set), then 18:09:15 and 18:15:26 `New nodes are installed but this run does not use them — skipping the engine restart`. No restart toast. Before this change the same step restarted the engine on every install (07:58 qwen-edit, 08:03 boogu-edit-balanced).

## Not covered

- The restart-when-needed path live: no model the user can install brings a node pack missing from the engine, so it rests on the unit tests until one does.
- Pod twin left as is on purpose: no model install reaches `remoteComfyNeedsRestart` now (`docs/runpod-remote-engine.md`), and the wrapper has no `/object_info` route.

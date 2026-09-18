# MPI-805 — a Restart engine button users can actually reach

## Why

Until MPI-800, a model-folder change applied **live**: `routes/comfy.js` wrote
`extra_model_paths.yaml` and then POSTed `/mpi/reload-extra-paths` to the running engine
(`reloadExtraPathsWhenReady`, MPI-219). Nothing restarted and the user was never told anything.

MpiNodes 1.2.13 deleted that route — it was unauthenticated, a Comfy Registry finding — so
MPI-800 (`ee034559`) replaced the call with a `restartNeeded` flag and an info toast:
*"Restart the engine to apply the model folder change."*

The app has no restart button. `_restartEngine` in `js/shell/navigation.js:340` is reachable
only from the **dev-only Ctrl+Tab radial** (`APP_CONFIG.dev_mode`), and its own comment says so:
"outside this dev-only radial nobody restarts ComfyUI by hand at all". That was true when
nothing asked them to. Now something does, and a shipped user is told to perform an action the
UI does not offer. Found by Fabio while running MPI-800's own validation checks.

## Approach

`_restartEngine` already does the whole job — idle-queue guard with a 30s wait, the refusal
toast, remote vs local branch, the 2s gap between stop and start. None of that is re-implemented
or moved.

- `js/events.js` — document `'engine:restart'`.
- `js/shell/navigation.js` — `Events.on('engine:restart', _restartEngine)`. The event, rather
  than exporting the function, because a Compound reaching into a shell module for a behaviour
  is the layering this repo routes through `Events`.
- `MpiSettings.js` — a plate at the END of the External Connections section, after the folder
  groups that cause the ask. `MpiButton` -> `Events.emit('engine:restart')`.
- The toast gains a pointer to it. It only ever fires from this panel (the folder controls live
  here and nowhere else), so naming the button is accurate, not a guess.

## Not doing

- No auto-restart. `_restartEngine`'s comment is explicit that every app-initiated restart
  refuses on a busy queue "because there nobody asked and the cost is someone's finished work".
  A folder change is not worth destroying a running generation.
- Not touching the drag-drop path. Verified: dropping a LoRA hits `POST /comfy/import-model`,
  which copies a file into an already-registered folder and never rewrites the yaml, and
  ComfyUI's `folder_paths.cached_filename_list_` invalidates on the folder's **mtime**, so the
  new file appears without a restart. A folder ADDED to the yaml is absent from
  `folder_names_and_paths` until boot, which is why only that case needs one.
- Not reviving a reload route. It was removed upstream for a security reason.

## Ownership

`js/events.js`, `js/shell/navigation.js`,
`js/components/Compounds/LandingPages/MpiSettings/MpiSettings.js`,
`js/components/Compounds/LandingPages/MpiSettings/MpiSettings.css`.

## Verification

**Verify mode:** user-ux — the point is a control a user can find and press.

1. `npm test` + `lint:components` stay green.
2. In the app: Settings → External Connections → add a LoRA folder → the toast names the button
   → press Restart engine → the engine restarts and the new folder's LoRAs appear.
3. Press it while a generation is running → the existing refusal toast, generation untouched.

## Current State

2026-09-18 ~00:15Z. Code COMPLETE, committed, NOT yet checked by Fabio. `'engine:restart'` is
documented in events.js and subscribed in navigation.js to the existing `_restartEngine` (the
handler itself is untouched); the Restart engine plate is the last row of External Connections;
the folder toast now names it. `npm test` 1321 / 1320 pass / 0 fail, lint clean.

NEXT: Fabio presses it after a folder change (engine restarts, new folder's LoRAs appear) and
once mid-generation (the existing refusal toast, generation untouched). Then close-out.

# MPI-1345 validation

## Root cause (two faults in `js/shell/floatLatentBridge.js`)

1. The bridge resolved a frame's generation from `generationStore.activeGenId(lane)`, not
   from the frame's own `promptId`. During an MCP-driven H3 `ref2v_ms` session (user log,
   2026-10-29 ~03:00) that answered null: the tile caption fell back to "Generating" (the
   screenshot), no clip meta reached the player, it stayed in STILL mode and painted one
   frame per sampler burst, so it froze after the first step.
2. `laneFor` folded `cloud`/`tool` jobs onto `local`, so a Describe or cloud edit finishing
   mid-render stopped the local video's loop (and a sequential successor's loop was stopped
   by its predecessor's `complete`).

## Evidence

- `node --test tests/float-latent-bridge.test.cjs` drives the real bridge with a fake
  ipcRenderer: GREEN on the fix.
- Same test on `HEAD`'s bridge: RED, "the tile must LOOP the clip, saw 1 distinct frame(s)"
  — the reported freeze.
- Fix with only `laneFor`'s cloud/tool fold restored: RED, "a cloud job has no tile to freeze".
- Related suites (previewClipPlayer, flow-gallery-placeholder, flow-latent-no-strobe,
  gallery-card-teardown): 19/19 pass. ESLint clean on both files.

## Remaining (human eye-test)

A real video run with the app minimised: the Latents tile keeps looping every step and is
captioned with the model's name, not "Generating".

## Round 2 (2026-10-29): Fabio eye-test FAILED, then fixed

Fabio: tile still froze, changing once per step. Real root: the loop ran in the APP renderer,
which is HIDDEN while minimised. Electron probe: minimise() -> visibilityState hidden, a 41ms
interval ticked ~10/10s (not ~240), for 4.5 min. Fix: the player runs in main/float-latent.html
(visible window, ownsFrames on its own blob URLs); the bridge forwards each frame's bytes once,
in order, with clip meta, plus a queued float-latent:reset; seeds a mid-step open with the
current clip. Evidence: tests/float-latent-bridge.test.cjs green; driving the real
float-latent.html in Electron with an 8-frame burst cycled 8 distinct frames in 2s, caption
Singularity H3, frozen after finalize. Related suites 19/19, eslint clean.
Remaining: Fabio restarts the app (main-process change) and minimises during a video run.

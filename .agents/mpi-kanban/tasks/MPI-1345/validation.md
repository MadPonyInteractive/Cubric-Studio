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

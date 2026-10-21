# MPI-1238 validation

Shipped in `92a5c410f`.

- `tests/desktop/scene-queue-hotkey.spec.js`, keys pressed after real clicks on the 360 player's
  viewport, scrubber and frame picker: Q toggles Cue, A toggles Agent mode, Tab opens the radial,
  Escape returns to the gallery. In the Scene, Q and A fly (no queue, no Agent mode), the open
  queue takes the first Escape, Tab opens the radial, the second Escape returns to the gallery. Passes.
- Same spec against HEAD's code before the fix: fails at A in the 360 player (Agent mode never toggles).
- `tests/hotkey-gating.test.cjs`: Scene leg now stubs `.mpi-scene-block`; new 360-player leg. 5/5.
- `npm run lint` clean, `npm test` 3506 pass / 0 fail; radial-menu, scene-workspace and
  scene-pano-video desktop specs pass (one radial test hit a 30 s load timeout once, passed alone).
- Q in the 360 player already worked before this card (old spec + real clicks); not reproduced as
  broken. If Fabio still sees it dead, ask what had focus.

# MPI-1038 brief

Tile Detailer Flow: Klein 9B redraws the picture tile by tile (Impact tile SEGS) to add real
detail; an optional lanczos upscale runs first. Detail-only when upscale is off.
Source recipe: Fabio's bench "Flow Tile Detailer", MPI-623 validation.md § Super upscaler.

## Noticed
- Flaky desktop spec `model-settings-popup.spec.js`: failed 3/3 in CI on 01524eb07 and 4x locally, then passed on re-run and on b68515f49 with the same code. Likely race: MpiModelSettings re-renders on `state:changed` availableLoras/upscaleModels, and an async asset rescan landing inside the spec 150 ms click window wipes the open popup. Unconfirmed; `hero-connecting.spec.js` went red the same hour on a scene-only commit.

# MPI-865 — Cloud models in the model PICKER: family colours and a paid badge

**Phase 3 of MPI-849** (the paid-cloud-models umbrella). Plan: `.agents/mpi-kanban/tasks/MPI-849/plan.md`.

Fabio, 2026-09-21, looking at the model selection library (`MpiModelPicker`, NOT the Model
Library `MpiModelManager` that MPI-853 covered). The sixteen cloud models now appear there
mixed in with the local ones and nothing distinguishes them.

## What he asked for

1. **A badge in the tile's top-right corner** marking a cloud / paid model, in the same slot
   and style as the existing featured star — `.mpi-tile__flag` in
   `js/components/Primitives/MpiTileSheet/MpiTileSheet.css:120-131`, where
   `--featured` and `--deprecated` already live. A new `--cloud` (or `--paid`) flag beside
   them, with its own icon from `js/utils/icons.js` and a hover explainer like the others.
2. **Correct colours.** Same rule MPI-853 applied to the price chip: DESIGN.md's "colour
   states what a surface is ABOUT", so a cloud image model reads Vision rose and a cloud
   clip model Video orange.

## Two bugs the same screenshot shows, both in `MpiModelPicker.js`

- **`MpiModelPicker.js:63` — `const tier = model.sizeTier || 'balanced'`.** Every cloud tile
  therefore reads `CLOUD · BALANCED`. A cloud model has no weights and no weight tier, so
  that word is meaningless on it; the meta should fall back to something true (the price, or
  just `CLOUD`) rather than to a size class it does not have.
- **Cloud tiles offer a `LORA & UPSCALE` button.** Neither is reachable on a DeepInfra
  endpoint: there is no LoRA rack and no upscale op in `supportedOps`. Verify against the
  ModelDefs before deciding whether to hide the control or disable it with a reason.

## Existing colour debt to decide on, not to assume

`MpiTileSheet.css:137-140` gives the MEDIA flags `--ink-2` / `--accent-frost` /
`--accent-warn`, deliberately matching the media section headers rather than the family
accents. Fabio already observed (MPI-853, 2026-09-20) that the library's media heads do not
carry their family colours and called that **a wider colour pass, not that card**. This card
should either be that pass or explicitly stay out of it — ask before repainting the media
flags, because they are shared with the Flow Library.

## Ownership note

`MpiTileSheet.css` and `MpiFlowLibrary.js` were MPI-831's; that session is closed and its
claim was released 2026-09-21. `MpiTileSheet.js` is still listed under its claim.

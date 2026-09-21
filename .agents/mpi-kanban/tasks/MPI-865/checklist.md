# MPI-865 Checklist

Derived from `.agents/mpi-kanban/tasks/MPI-849/plan.md` § Phase 3 and this card's `brief.md`.

- [x] A `cloud` row in `TILE_FLAGS` (`MpiTileSheet.js`), so the badge lands in the same
      top-right stack as `--featured` / `--deprecated` rather than as a second mechanism.
- [x] The picker's `_tileItem` sets that flag from `!!model.provider` — the one discriminator
      `MpiModelManager` already uses.
- [x] Flag colour follows DESIGN.md's "colour states what a surface is ABOUT": Vision rose on
      a cloud image model, Video orange on a cloud clip model — the same rule MPI-853 gave the
      price chip.
- [x] Bug 1: `CLOUD · BALANCED` is gone. A cloud model has no weight tier, so the meta must not
      fall back to one.
- [x] Bug 2: the `LORA & UPSCALE` control no longer offers what a DeepInfra endpoint cannot do.
      Confirm against the ModelDefs before choosing hide vs disable-with-reason.
- [x] A test guards each of the three, so a later edit cannot silently undo them.
- [x] `npm test` green.
- [ ] Fabio's look in the app (verify mode is `user-ux`).

## Explicitly NOT in this card

The media flags' colours (`--mediaImage` / `--mediaVideo` / `--mediaAudio`,
`MpiTileSheet.css:137-140`). They are shared with the Flow Library and Fabio already called
repainting them "a wider colour pass, not that card". Ask before touching them.

# MPI-838 — checklist

Derived from `plan.md` § Remaining Work.

- [x] Spinner: toggle the WRAPPER at the call site (kills the scrim) + `.mpi-spinner[hidden]`
      rule on the primitive so the next caller cannot repeat it.
- [x] `range-preview` on MpiTrimBar, throttled, in/out only — `range-change` stays on pointerup.
- [x] Forward `range-preview` through MpiGifControlBar to the frame strip and the panel note.
- [x] Bind Home / End / I / O / X in MpiGifControlBar on the existing `video.*` ids.
- [x] Specs for all three faults in `tests/desktop/gif-workspace.spec.js`.
- [x] Docs: the new trim-bar event in `docs/video-player.md`, the GIF keys in `docs/gif.md`.
- [x] GIF + video desktop specs green with `--output=C:/pw838`, lint clean.
- [x] Fabio's check in the app (verify mode is `user-ux`).

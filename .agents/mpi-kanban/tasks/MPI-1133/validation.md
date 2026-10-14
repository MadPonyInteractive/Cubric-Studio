# MPI-1133 validation

Research card. Nothing was built or shipped.

- **Delivered:** `research/shortlist.md` (2026-10-13). It covers the drift list for Qwen 2.1/ref2v_001,
  the graph-level cause (stage 1 sees each sheet at ~640x416, so a face is ~120-140 px wide), six
  ranked options with licences read by hand, and a bench plan.
- **Settled by Fabio's own test (2026-10-14):** higher resolution fixes the face drift. That is
  consistent with the stage-1 face-size cause. No identity option is adopted and no bench was run.
- **Folded forward:** RefMod (`ComfyUI-MiniMaxH3Mod`, no-training reference mods, MIT) goes into
  MPI-815 Elements as Phase 4: one mod file per character element, benched before any wiring.
  The other options (musubi-tuner identity LoRA, UntMods FaceSwap LoRA, frame-level swap) stay
  on record in `research/shortlist.md`. None of them has a card.
- **For MPI-1135 (draft resolution):** a low draft canvas shrinks the reference faces in stage 1,
  so the draft resolution the Story pipeline picks bears directly on character identity.

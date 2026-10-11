# MPI-1060 Checklist

- [x] Phase 2b composer: `routes/ingredientsSheet.js` + `POST /engine-sheet` + `_composeReferenceSheet`, `tests/ingredients-sheet.test.cjs` 9/9 (2026-10-10)

## Parallel Batch - app wiring + agent knowledge (2026-10-10, session "LTX 2.3 Reference 4")

- [x] LTX cards: `referenceSheet`, `audioRouting`, `ref2v_ms` op + workflows; H3 `multiRefMedia`
- [x] ref2v_ms slot narrowing (9 pictures, 1 audio, start frame on LTX; H3 unchanged)
- [x] `help.byModel.ltx` (D5), modelPriority REF2V + NOTES, ROLE_USE.inputStartFrame
- [x] audioMode/useAudio gate moved to `capabilities.audioRouting` (PromptBoxControls)
- [x] Recipe `r2v` mode (draft) + agent guide section
- [ ] Recipe Stage 1 sweep (ask Fabio first)

## Phase 5 - live verify (2026-10-11, session "LTX 2.3 Reference 5")

- [x] LTX Balanced staged into `G:/CubricModels` (12 deps, sizes == dep bytes)
- [x] Prompt-box run in own Electron instance: card + sidecar, clip holds the sheet
- [x] `/connector/generate` run 16:9: card + sidecar (failed before the role fix, passes after)
- [x] Portrait 9:16 run (failed before the role fix, passes after)
- [x] Fix: unlabelled Picture 1 = character unless another line says `character:` (composer, test, guide, recipe)
- [ ] Fabio's eye-test of the Phase 5 clips
- [x] Start-frame toggle on the picture tag (Fabio's spec): desktop spec + live run pass

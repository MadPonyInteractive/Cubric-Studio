# MPI-1060 Checklist

- [x] Phase 2b composer: `routes/ingredientsSheet.js` + `POST /engine-sheet` + `_composeReferenceSheet`, `tests/ingredients-sheet.test.cjs` 9/9 (2026-10-10)

## Parallel Batch - app wiring + agent knowledge (2026-10-10, session "LTX 2.3 Reference 4")

- [x] LTX cards: `referenceSheet`, `audioRouting`, `ref2v_ms` op + workflows; H3 `multiRefMedia`
- [x] ref2v_ms slot narrowing (9 pictures, 1 audio, start frame on LTX; H3 unchanged)
- [x] `help.byModel.ltx` (D5), modelPriority REF2V + NOTES, ROLE_USE.inputStartFrame
- [x] audioMode/useAudio gate moved to `capabilities.audioRouting` (PromptBoxControls)
- [x] Recipe `r2v` mode (draft) + agent guide section
- [ ] Recipe Stage 1 sweep (ask Fabio first)

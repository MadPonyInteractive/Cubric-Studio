# MPI-1283 Validation

## 2026-10-26, automated + live (auto mode)

- `npm test`: 3689 pass, 0 fail. `tests/recipe-registry.test.cjs` `testAppWritesTheSubjectSections`:
  sections shape, `appears in` per citing shot, place and undescribed pictures skipped, an
  ethnicity/skin clause dropped, a leading "wearing" dropped, LTX keeps its picture lines.
- eslint clean on the four changed files.
- Live, my own isolated Electron (own profile, port 54783), real `enhance()` for
  `minimax-h3-ref2va` / `ref2v_ms`, the two MPI-1135 sheets (`flowCharacterSheet_087/084`),
  describer + enhancer on DeepInfra Gemma 4 26B (Fabio switched from the local describer so the
  check was not stuck behind his GPU). Output opened with both sections; traits matched the
  sheets (her ombre bob, fringe, gold pendant necklace, full-body tattoos, black string bikini;
  his grey hair, stubble, white shorts, white sneakers, brown leather crossbody bag, tattoos). No
  ethnicity, origin or skin tone. Enhancer prompt below unchanged in shape.
- Not checked (as in the bench): whether the sections help FACE identity; an H3 render with them
  through the app (the bench already rendered Shot Cs).

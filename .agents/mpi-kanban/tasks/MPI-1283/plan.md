# MPI-1283 Plan

## Goal
H3 r2v enhance output = app-written `subject_definitions` + `retention_analysis`, then the
enhancer's own prompt unchanged below (the MPI-1135 Shot Cs shape).

## Steps
1. `js/services/llmService.js`: a looks-only TRAITS question (hair, eyes, facial hair, what it wears
   and carries, markings; never ethnicity, nationality, origin or race), asked once per picture and
   only for a mode that wants sections, kept in the card sidecar as `lookTraits`.
2. `js/data/recipes/registry.js`: `withSubjectSections(text, captions)`: one `<Subject N>` per
   person/animal/object picture, `appears in` from the `[Shot N]` lines citing that picture
   (fallback `[Shot 1]`), `fully_preserved - <traits> are retained.` Place pictures get none.
3. `enhance()`: the LTX `withPictureLines` rewrite only for modes that declare it; H3 r2v gets
   `seesPictures` + `subjectSections` and the new builder.
4. `minimax-h3.recipe.js`: header + description corrected (sections adopted, app-written).
5. Tests in `tests/recipe-registry.test.cjs`; lint + full test.

## Verification
**Verify mode:** auto
- `npm run lint`, `npm test` green.
- Live: isolated app, local describer, two staged character pictures, one H3 Reference enhance:
  sections on top, traits match the pictures, no ethnicity words.

## Completed
- 2026-10-26: steps 1-5. `TRAITS_QUESTION` + `lookTraits` (llmService `pictureCaptions(..., { traits })`),
  `withSubjectSections` (registry; a word list drops a clause naming ethnicity/origin/skin tone, also
  from older sidecars: a backstop behind the question, not a guarantee, and it can over-drop
  e.g. "Indian ink tattoos"), H3 r2v `seesPictures` + `subjectSections` (LTX keeps `withPictureLines`), recipe header +
  description. `npm test` 3689 pass / 0 fail, eslint clean on the four files.

- 2026-10-26: live enhance passed on DeepInfra Gemma 4 26B (validation.md); leading "wearing" fix.

## Remaining Work
- Close-out (commit by pathspec, push) so it rides along with 2.1.3 (MPI-1286).
- Not checked, as in the bench: whether the sections help FACE identity.

## Current State
Done and verified, nothing committed. Next: mpi-end-session.

## Plan Drift
- 2026-10-26: live check moved from the local describer to DeepInfra (Fabio: the GPU was busy).

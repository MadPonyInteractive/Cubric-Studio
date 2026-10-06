# MPI-1029 - H3 ref2v fails: comfy-aimdo file read error 1450

Problem, evidence and the reverted first attempt: `checklist.md`. Fix and live proof: `validation.md`.

## Noticed

- 2026-10-06 07:32Z: one H3 ref2v (ref2v_004, seed 3056446617) was followed 0.3 s after it
  finished by an identical-prompt job from the app's own queue (ref2v_005, seed 3248824313).
  Fabio is unsure whether he pressed Cue twice. Not provable from the log: Cue presses are not
  logged, and `commandExecutor.js:825` draws the seed at dispatch, so a duplicated job would also
  get a new seed. Card it only if it happens again.

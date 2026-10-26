# MPI-1297 validation

Fabio 2026-10-26: a plain adult woman (photo, dress, bedroom) on Depth control with nudity in the
words was refused. The live log showed `refused a user run of control (picture)` after the map
check answered YES. The map had no face, and maps got no age guess, so that YES was final and was
saved on the card.

Fix: Depth / Canny / Scribble now look at the input photo like any other picture (age question,
doodle question, age guess, where 20 or more lets the words decide). Pose is unchanged and stays
words-only. The map look is removed: `controlMapOf`, `_describeControlMap`, the
`controlMapDescribe` op (commandRegistry, operationRegistry, operation_registry.json,
universal_workflows) and `comfy_workflows/control_map_describe.json`.

Evidence:
- `tests/child-safety-gate.test.cjs`: Depth/Canny/Scribble and no-picker runs with an age guess of 25 queue; guesses of 10 and 17 refuse with CHILD_SAFETY; the photo itself is what gets described; an innocent control run is never looked at; Pose is unchanged.
- `npm run lint` clean; `npm test` 3684 pass, 0 fail, 2 skipped; `release-health-check.mjs` passed.
- Not checked live in the app: the same path is covered by the gate tests with a stubbed describer.

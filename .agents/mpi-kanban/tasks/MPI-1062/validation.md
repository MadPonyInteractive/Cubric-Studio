# MPI-1062 validation

## 2026-10-10, session 8ef88b5e (code, uncommitted)

- `node --test tests/child-safety.test.cjs tests/child-safety-gate.test.cjs`: 33 pass, 0 fail.
  New: a clip with "remove her clothes" waits for the describer, which is handed the card's 1280
  poster; queued on NO; refused on YES; a clip with no card (the renderer grab cannot run under
  Node) is refused with "could not run" and the describer is never asked; an innocent clip edit
  ("make it night") queues at once with no describe call. `picturesOf(run, 'video')` lists each
  clip once; `pictureCheck([..., null])` refuses without asking.
- `node --test "tests/**/*.test.cjs"`: 3024 tests, 3022 pass, 0 fail.
- `npx eslint js/data/childSafety.js js/services/generationService.js`: clean.
- Not run live: the renderer first-frame grab for a clip with no card (copy of
  `flowEnhance.stageFirstFrame`, which Video Edit's describe step already runs).

Code committed `7ecd4e05d`, pushed; tests.yml run 38076045694.
Docs (`docs/child-safety.md` § Where it runs + § Known gaps) committed separately.

Release note: the MPI-1056 bullet now reads "in a picture or clip" (Fabio's yes, 2026-10-10).

Still to close: CI green on `7ecd4e05d`.

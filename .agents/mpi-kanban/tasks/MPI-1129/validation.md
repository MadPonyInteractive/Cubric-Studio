# MPI-1129 validation

Root causes (both in the bench's fake tools, never the app):
1. `fakeTools` had no `storedLook`/`storeLook`, so a plain `look` at a generated card threw
   `this._tools.storedLook is not a function` (TOOL_ERROR). The model read it as a bad ref and
   guessed `grp_1`, the filename and the raw path (all IMAGE_NOT_FOUND) to STEP_LIMIT. The ref
   generate hands back (`/project-file?path=...`) was always the key `look` resolves.
2. The room/park look fixtures had no entry for the result file, so a look at the edit fell back
   to the FIRST look: the furnished source photo. The model read its edit as unchanged and redid it.

`guide:flux-2` for qwen-edit is by design (`enhanceRecipe: 'flux'`, RECIPE_ALIASES; flux-2.md covers qwen-edit).

Commits: 59e8bd735 (look store), 99dad628e (result descriptions). Regression test in
tests/agent-bench.test.cjs, bite-checked for both causes.

- `node --test tests/agent-*.test.cjs`: 509 pass, 0 fail.
- Live 3x3, first fix only: 8/9, $0.0572 (room #2 STEP_LIMIT on cause 2).
- Live 3x3, both fixes: 9/9, $0.0481 (outpaint 3/3, room-every-editor 3/3, character 3/3).

Not done: fakeTools still lacks listCards, visibleCards, markCard, the GIF tools,
quoteGeneration, cancelGeneration and global memory; no case exercises them.

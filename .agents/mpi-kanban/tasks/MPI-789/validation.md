# MPI-789 validation

## The failure

CI run 35150684500 (master, 568f3ce6), `tests/desktop/llm-settings-remote.spec.js:20`. From the
trace: every label assertion passed, the toggle ran at +26 ms, and then
`.mpi-dropdown__list.is-open .mpi-dropdown__option-label` resolved to 0 elements for the full 5 s.
The trace has no DOM snapshots (Electron), and the screenshot shows only the 18+ gate over a
blurred page, so the code path settled the cause.

## Root cause

`MpiLlmSettings` called `_init(el)` in `setup` and again from `el.onOpen`, and `MpiSlideOver`
calls `onOpen` right after it mounts the panel. So every Remote open ran two full init passes.
Each pass calls `enhancerModels()`, which sends its own `GET /llm/models`. When the two replies
came back in order, the second pass cancelled the first through `_detailsSeq`, so nothing showed.
When they came back out of order, the early pass painted every row, and the late pass then
destroyed and rebuilt them, closing any open dropdown. `MpiDropdown.destroy()` removes the
portalled list, which is the 0 elements.

`MpiSettings` and `MpiRunpodSettings` init from `onOpen` only. `MpiQueuePanel` also renders in
both places, but its `_render` is synchronous, so the two calls cannot cross.

## Proof

- **Reproduced the CI symptom locally.** The spec held every `/llm/models` reply after the first
  and released it right after the toggle (a one-off experiment, not kept). Without the fix: 1 reply
  held, and the list failed with `9 × locator resolved to 0 elements`, the same text as CI. With the
  fix: 0 held, green.
- **Guard kept in the spec:** it counts `/llm/models` requests right after `slide-over:open`. Both
  passes send theirs before their first await, so the count is exact with no wait and no dependence
  on reply order.
- **Mutation test** (`scripts/mutate-check.mjs`, restoring the setup `_init(el)` call): killed.
  `Expected: 1, Received: 2`, and the file was restored.
- `--repeat-each=10`: 10 passed (33.4 s).
- `runpod-settings-extract.spec.js` (the other spec that opens `MpiRemote`): passed.
- `npm test`: 1219 pass, 0 fail. `eslint` on both changed files: clean.
- Committed in 6e7b7082 and pushed. **CI run 35156000365: success.** The spec shows
  `ok 78 ... llm-settings-remote.spec.js:20:1 (3.1s)`, and the desktop suite passed 101 of 101 in 10.9 min.

# MPI-1081 - Enhance on a reference-to-video op with nothing attached uses the text-to-video rules

Found by MPI-1060's Stage 1 recipe sweeps (2026-10-11). Fabio: "close it and make the card".

## The bug

Enhance on a reference-to-video op (`ref2v`, `ref2v_ms`) resolves the recipe's `r2v` mode, and the app
appends "Attached references, in load order: none." when nothing is staged (`withReferences`,
`js/data/recipes/registry.js`). The 12B enhancer (`gemma-4-abliterated-12b`) still invents a tag:

- **LTX 2.3 r2v:** writes a `<Picture 1> ...` line in 11 of 15 runs. With no picture the sheet composer
  never runs (it needs a filled `Input_Image`), so that line goes to LTX as stray prompt text.
- **Wan 3.0 r2v:** writes `<Image 1>` in its `directed` tier (open case in
  `docs/recipes/research/wan-3.0/validation.md`; three rewordings did not move it).

MPI-1060 also tried Wan's "ONLY REAL TAGS, AND EVERY ONE OF THEM" rule in the LTX recipe: no fix. Sweep
outputs and counts: `.agents/mpi-kanban/tasks/MPI-1060/validation.md` § Recipe r2v Stage 1.

## The fix (root cause: the wrong mode, not the wording)

Nothing attached = nothing to reference = text to video. In `js/services/llmService.js` (~line 835):

```js
const resolvedMode = resolveMode(recipeId, mode ?? recipeModeForOp(operation));
...
const userText = resolvedMode === 'r2v' ? withReferences(idea, references ?? []) : idea;
```

When the resolved mode is `r2v`, `references` is empty and the recipe has a `t2v` mode, enhance with
`t2v` instead (and send the plain idea). Check every caller passes `references` (prompt box
`MpiPromptBox.js` ~line 2456 `_stagedRefTags()`; the agent / MCP enhance path; Flows' in-graph enhance)
so "empty" means "nothing staged", not "caller did not say". Seedance r2v currently PASSES its no-ref tier;
confirm it still does on t2v.

## Verify

- Unit: `tests/llm-service.test.cjs` gets a case: r2v op + no references -> the t2v system prompt and no
  "Attached references" line; r2v + one reference -> unchanged.
- `node scripts/recipe-test.mjs` has no switch for this (it calls the recipe mode directly): the plain
  `--mode r2v` sweep keeps failing by design once the app no longer sends that case. Say so in the Wan and
  LTX validation records rather than chasing the sweep.
- `node --test tests/recipe-registry.test.cjs tests/agent-corpus.test.cjs tests/llm-service.test.cjs`.

## Not this card

- The LTX r2v with-pictures noise (9/12: an `<Audio 1>` line in the picture block twice, one output 2 words
  under the 80 floor). A wording pass for later, recipe stays `draft`.

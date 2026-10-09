# MPI-1048 validation

## Phases 1-6 (2026-10-09)

- `validateRecipe(qwen-image-2.1)` -> `[]`; `node --test tests/recipe-registry.test.cjs` pass (count 13 -> 14).
- Playbook 07 read-back: `Qwen-Image 2.1 image ["guide:qwen-image-2.1"]`, all seven ops ranked (t2i/i2i/control/edit/detail 7, inpaint 5, upscale 8).
- `node --test tests/agent-corpus.test.cjs tests/model-priority.test.cjs tests/agent-prompt-budget.test.cjs tests/recipe-registry.test.cjs`: 22 pass, 0 fail.
- Guide: 134 lines, no em dash, no `$`.

## Phase 3 Stage 1

Not run yet: GPU held by the app engine (13.2 GB idle), Ollama quit. See plan Current State.

- 2026-10-09 (session 3e2b8b66): Stage 1 ALL PASS twice (sweeps 3+4, 15/15, judge 2/2/2 on all 30) after two recipe
  fixes; record in `docs/recipes/research/qwen-image-2.1/validation.md`. Agent tests 21/21, recipe test green, npm test 2800/0.

## Reopen: stated details + the alpha-line leak (2026-10-09, session cd9258be)

- Field failure: Fabio's Enhance (DeepInfra `google/gemma-3-12b-it`) dropped "water up to her knees".
- DeepInfra A/B on gemma-3, the app's own model and call shape, 8 runs per cell: `deepinfra-ab.txt` (script
  `deepinfra-ab.mjs`). Stated detail in the OPENING sentence: knees 0/8 -> 8/8, held-out roof+rain+umbrella
  0/8 -> 8/8. Found on the way, worse than the knees: the committed recipe made gemma-3 end 13/16 ORDINARY prompts
  with "The image has alpha channel and the background is transparent." (gemma-4 never did, so Stage 1 never saw it).
  After the transparency gate: 0/16, while the sticker case keeps both RGBA lines 8/8. Invented car brands 2/8 -> 0/8.
  Residual: gemma-3 splits about 1 output in 8 into paragraphs at section boundaries (OLD did too); harmless to the encoder.
- Spend: ~1.2 cents of Fabio's 2-cent cap.
- npm test 2817/0 (2 skipped) with the recipe change + MPI-936's rack in the tree.

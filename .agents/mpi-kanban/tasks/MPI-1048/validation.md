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

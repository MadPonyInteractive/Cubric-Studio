# MPI-1208 validation

## Half 2 - tool facts (2026-10-19)

What changed, all facts at pick time, no route rule:
- `modelPriority.js` OP_NOTES: one note on every edit op (`edit`, `kleinEdit`, `krea2Edit`, `qwenEdit`):
  what it changes, that it keeps the first picture's shape unless it lists ratios, later pictures are sources.
  i2i note: at a denoise that keeps the person, pose, layout and clothes stay.
- NOTES: Qwen-Image 2.1 edit opens "the best editor here"; Boogu "the strongest editor here" -> "a strong
  editor"; Klein 9B "the native editor" -> "edits in place"; Klein 4B "small native" -> "smaller Klein editor".
  Both words outranked rank 1 in the live run. EDIT order untouched.
- crop note: "It changes the shape only: what is left is untouched."
- Outpaint description's first sentence (its agent `does`, and the Flow Library card): "Extend an image past its
  edges into a new shape, the new area painted from what you describe."
- OP_RULES `shape`: "a ratio here only crops the picture before the run ... changes nothing else"; no longer
  fires on edit ops (FLUX.3 Klein's edit ratio re-composes a new frame, not a crop - Flux.3 integration 5).
- System prompt Plan rule (+248 bytes, budget 12,074 -> 12,322).
- Bench case `shape-then-edit` (services/agentBench.mjs): crop or Outpaint before an edit, no i2i; flip keeps it square.

Evidence:
- `node --test tests/agent-*.test.cjs tests/flow*.test.cjs tests/model-priority.test.cjs tests/connector*.test.cjs`:
  924 tests, 923 pass, 0 fail (1 skipped).
- `node --test tests/agent-loop.test.cjs`: 196 pass, 0 fail.
- New case's check exercised on synthetic runs (crop+edit and outpaint+edit pass; i2i, edit-before-crop,
  edit-only fail).
- NOT run: the live bench case against a model. It bills DeepInfra; waits for Fabio's yes with the Half 1 runs.
- CI: run 39332677834 (Tests) green on 3020e6307.

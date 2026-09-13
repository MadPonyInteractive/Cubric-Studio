# MPI-747 Validation

## Automated — PASSED (2026-09-13)

- `node --test tests/flow-output-display.test.cjs tests/flow-result-compare.test.cjs tests/flow-defer-commit.test.cjs` -> 18/18 pass.
- `node --test tests/inject-params-titles.test.cjs` -> 23/23 pass.
- `node scripts/validate-injection-rules.mjs comfy_workflows/flow_head_swap.json` -> conforms.
- `node scripts/verify-workflow.mjs comfy_workflows/flow_head_swap.json` against the engine on 48188 -> 35 nodes validate.
- `node --check` on `commandExecutor.js`, `generationService.js`, `MpiBaseFlow.js` -> OK.

These pin wiring only; the surfaces are DOM-only.

## Live — PENDING (Fabio, in his own app, Head Swap)

1. Run Head Swap: the final stage shows the Output_Display view (both inputs beside the result).
2. Exactly ONE new gallery card, and it is the swapped image.
3. The frame's toggle reaches Compare, and back to Display.
4. Step back off the last step: the floating window shows the display.
5. Close and reopen the flow: the display comes back.
6. After an engine restart, reopen: the pane falls back to the saved result, not empty.

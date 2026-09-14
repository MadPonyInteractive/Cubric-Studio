# MPI-747 Validation

## Automated — PASSED (2026-09-13)

- `node --test tests/flow-output-display.test.cjs tests/flow-result-compare.test.cjs tests/flow-defer-commit.test.cjs` -> 18/18 pass.
- `node --test tests/inject-params-titles.test.cjs` -> 23/23 pass.
- `node scripts/validate-injection-rules.mjs comfy_workflows/flow_head_swap.json` -> conforms.
- `node scripts/verify-workflow.mjs comfy_workflows/flow_head_swap.json` against the engine on 48188 -> 35 nodes validate.
- `node --check` on `commandExecutor.js`, `generationService.js`, `MpiBaseFlow.js` -> OK.

These pin wiring only; the surfaces are DOM-only.

**CI RED on bb72e0a0, fixed 2026-09-13 (`3dad1396`):** `flow-output-display` failed only on the
runner. Its `_lastResults = null;\n\s*_lastDisplay` anchor met a CRLF checkout (this tree is LF,
so local was green). Reproduced with a `readFileSync` preload serving the sources as CRLF, fixed
to `\r?\n`, then 5/5 under LF and CRLF.

## Live — PASSED (Fabio, in his own app, Head Swap, 2026-09-14)

Fabio: "Yeah, it works end-to-end." His screenshots show the Generate stage painting Output_Display
(both inputs stacked beside the result) with the Compare toggle under it, "Saved to your gallery",
and exactly ONE new gallery card, `flowHeadSwap_003` (514 x 793, 46 s). A second screenshot after
a reopen shows the display again. Decision: a fresh Generate does NOT reset to Display; a chosen
Compare stays (today's behaviour).

Checklist the run covered:

1. Run Head Swap: the final stage shows the Output_Display view (both inputs beside the result).
2. Exactly ONE new gallery card, and it is the swapped image.
3. The frame's toggle reaches Compare, and back to Display.
4. Step back off the last step: the floating window shows the display.
5. Close and reopen the flow: the display comes back.
6. After an engine restart, reopen: the pane falls back to the saved result, not empty.

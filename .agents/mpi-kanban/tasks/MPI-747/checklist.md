# MPI-747 Checklist

Scope widened at pickup (Fabio, 2026-09-13): `Output_Display` is GENERIC, image and video, for
every Flow. A Flow graph that carries it shows it in the Flow instead of the output; the gallery
card stays the output. Paired in one session with MPI-744's app wiring, because the Klein Head
Swap graph is the first consumer and the live test.

## Implementation

- [x] 1 - Capture: `commandExecutor.js` collects an exact `output_display` set, kept out of `outputNodeIds`, handed to `onComplete` as `displayUrls`.
- [x] 2 - Pass-through: `generationService.js` forwards `displayUrls` in `callbacks.onComplete`.
- [x] 3 - Surface: `MpiBaseFlow.js` paints the display instead of the output (pane AND floating window); the toggle cycles `_resultModes` (display, compare, player); N outputs + a display paints the display.
- [x] 4 - Reopen: `s_flowResults` carries `display`; its own HEAD probe at mount, and a miss drops only the display.
- [x] 5 - Docs: `result-pane.md` § Output_Display; capture-title comment; `state.js` shape comment.
- [x] 6 - Test: `tests/flow-output-display.test.cjs` (5 tests); `flow-defer-commit.test.cjs` regex loosened for the new field.

## Verify

- [ ] 7 - A Flow WITH `Output_Display` shows it on the final stage and lands exactly ONE gallery card (Fabio, in his app, on Head Swap).
- [x] 8 - A Flow WITHOUT it is unchanged: `tests/flow-result-compare.test.cjs` green.
- [ ] 9 - Close -> reopen shows the display; after an engine restart it falls back to the result.
- [ ] 10 - On Head Swap the toggle still reaches compare.

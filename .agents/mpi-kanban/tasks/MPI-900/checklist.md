# MPI-900 checklist

- [x] Passes (Fabio 2026-09-24, replaces the 25%-per-axis two-pass): each side grows at most a third of what the pass starts from; a third up AND down is one pass; more repeats (N passes) on each result. Pure planner + unit test (5 pass). flowService chains `runNextPass` until `last`.
- [x] AnyPaint evaluated and DROPPED (Fabio 2026-09-24): no outpaint win at a third; hair-colour inpaint 10x faster but 10x worse than ours. No dep added.
- [x] ONE pass on Klein (Fabio 2026-09-24): `maxGrow` removed from the crop step, so neither the flow frame nor the agent path splits. Pass machinery left idle (agentDispatch.js is MPI-891's).
- [x] Klein 9B ONLY (Fabio 2026-09-24): Krea arm, `Klein Or Krea`, `Input_Use_Klein`, `Input_is_Turbo`, `Input_Negative` removed from raw + runtime graph; slot `['klein-9b']`, no modelParams; Turbo field removed.
- [x] Baked instruction "Replace the black area with the rest of the image."; join delimiter a space, trim `\s+$` (keeps the bake's own full stop).
- [x] Paste-back + colour match: `MpiStepCrop._padTo` leaves the new area TRANSPARENT; ComposeColorMatch `Grade match (surround)` (dest = Input_Image, source = Klein decode, mask = Input_Image alpha) feeds Output_Image. `ComfyUI-Mickmumpitz-Nodes` in requiredDeps. Tests pin the wiring.
- [x] Prompt box: "What goes in the new area" (optional), joined after the baked fill instruction in the graph.
- [x] Agent half: DONE under MPI-891 (message 795acf67) — `params.frame.grow` + passes on the agent path.
- [x] Docs: existing-flows/outpaint.md rewritten for Klein-only + paste-back.
- [ ] Live generation on the user's GPU (Klein 9B, one pass, paste-back) - Fabio's check: original pixels unchanged, no seam at the border, output = frame at source resolution.

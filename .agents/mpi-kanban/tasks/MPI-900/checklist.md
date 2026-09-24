# MPI-900 checklist

- [x] Passes (Fabio 2026-09-24, replaces the 25%-per-axis two-pass): each side grows at most a third of what the pass starts from; a third up AND down is one pass; more repeats (N passes) on each result. Pure planner + unit test (5 pass). flowService chains `runNextPass` until `last`.
- [x] AnyPaint evaluated and DROPPED (Fabio 2026-09-24): no outpaint win at a third; hair-colour inpaint 10x faster but 10x worse than ours. No dep added.
- [ ] Paste-back + ColorMatch in flow_outpaint.json so original pixels never change colour (Klein shift).
- [ ] Flow frame (MpiBaseFlow) runs the two passes as ONE run: the pane completes on pass 2.
- [ ] Prompt box: "What goes in the new area" (optional), joined after the baked fill instruction in the graph.
- [ ] Klein arm: klein-9b / klein-4b as candidates in the Outpaint slot, lazy branch in the graph.
- [ ] Agent half: `params.frame.anchor` (grow up/down/left/right) + two passes on the agent path. Blocked on MPI-891's claim on js/shell/agentDispatch.js.
- [ ] Docs: existing-flows/outpaint.md.
- [ ] Live generation on the user's GPU (Klein + two-pass) - Fabio's check.

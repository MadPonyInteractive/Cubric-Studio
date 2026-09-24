# MPI-900 checklist

- [ ] Two passes: a crop that adds more than 25% of the source on an axis runs pass 1 (that axis grown by 25%), then pass 2 on pass 1's result to the full frame. Pure planner + unit test.
- [ ] Flow frame (MpiBaseFlow) runs the two passes as ONE run: the pane completes on pass 2.
- [ ] Prompt box: "What goes in the new area" (optional), joined after the baked fill instruction in the graph.
- [ ] Klein arm: klein-9b / klein-4b as candidates in the Outpaint slot, lazy branch in the graph.
- [ ] Agent half: `params.frame.anchor` (grow up/down/left/right) + two passes on the agent path. Blocked on MPI-891's claim on js/shell/agentDispatch.js.
- [ ] Docs: existing-flows/outpaint.md.
- [ ] Live generation on the user's GPU (Klein + two-pass) - Fabio's check.

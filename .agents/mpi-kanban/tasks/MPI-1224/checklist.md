# MPI-1224 checklist

- [ ] Test: agent i2v on an entry of the OPEN image card returns no history landing (fails before)
- [ ] Fix `workspaceGenerationOpts` + `maskedGenerationOpts` in `js/shell/agentDispatch.js`: the card must hold the output's media type, open or not
- [ ] Both engines: landing is picked in agentDispatch before `enqueueGeneration`, so cloud and local share it
- [ ] Unit tests green; push; CI green; close

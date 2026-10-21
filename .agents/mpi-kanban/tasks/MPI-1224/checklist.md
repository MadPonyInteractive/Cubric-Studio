# MPI-1224 checklist

- [x] Test: agent i2v on an entry of the OPEN image card returns no history landing (fails before)
- [x] Fix `workspaceGenerationOpts` + `maskedGenerationOpts` in `js/shell/agentDispatch.js`: the card must hold the output's media type, open or not
- [x] Both engines: landing is picked in agentDispatch before `enqueueGeneration`, so cloud and local share it
- [x] Unit tests green; push; CI green; close

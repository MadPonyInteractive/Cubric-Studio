# MPI-1231 checklist

Dev-gated until the LTX 2.5 release (umbrella MPI-1267).

## Phase 0: Panel recipe (local GPU)
- [x] Planner system prompt on `/llm/enhance` returning `[PANEL n]` blocks, parsed in JS
- [x] 2-3 storyboards by hand-run FLUX.3 Klein edit; Fabio's eye

## Phase 1: Flow
- [x] Flow dev gate: `devOnly` on a FlowDef, filtered on `APP_CONFIG.dev_mode` + unit test
- [x] Storyboard driver (deps for the renderer wired with the FlowDef) (`js/services/storyboardRunner.js`): jobs first then the stack, notes, reorder to panel order, overview + unit tests (order after interleaved arrival, failed panel, cancel)
- [x] FlowDef via `/mpi-add-flow`, `devOnly: true`, renderer deps wired (driver hook; not run live)
- [x] 6-panel board lands as one stack in order with notes + overview; Fabio's look (his live boards + the bat-cave run)

## Phase 2: Launch kit
- [x] `/mpi-flow-graphics` tile + hero (Fabio's eye 2026-10-26)
- [x] Agent knowledge (playbook 07): `does` read back, handover test pins `agentOpens: 'run'`
- [x] UNRELEASED roster line + entry, held for the LTX 2.5 release
- [x] Moved to MPI-1267 as a release check: Cosmo + MCP run the Flow, its `flows.md` paragraph

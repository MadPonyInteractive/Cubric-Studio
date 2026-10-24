# MPI-1231 checklist

Dev-gated until the LTX 2.5 release (umbrella MPI-1267).

## Phase 0: Panel recipe (local GPU)
- [ ] Planner system prompt on `/llm/enhance` returning `[PANEL n]` blocks, parsed in JS
- [ ] 2-3 storyboards by hand-run FLUX.3 Klein edit; Fabio's eye

## Phase 1: Flow
- [x] Flow dev gate: `devOnly` on a FlowDef, filtered on `APP_CONFIG.dev_mode` + unit test
- [x] Storyboard driver (deps for the renderer wired with the FlowDef) (`js/services/storyboardRunner.js`): jobs first then the stack, notes, reorder to panel order, overview + unit tests (order after interleaved arrival, failed panel, cancel)
- [ ] FlowDef via `/mpi-add-flow`, `devOnly: true`, renderer deps wired
- [ ] isolated app: 6-panel board lands as one stack in order with notes + overview; Fabio's look

## Phase 2: Launch kit
- [ ] `/mpi-flow-graphics`, agent knowledge page, UNRELEASED at the LTX 2.5 release

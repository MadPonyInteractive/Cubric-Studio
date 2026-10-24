# Storyboard (MPI-1231) — dev-gated

An idea in words, plus optional pictures of the cast and places (up to 10), becomes ONE stack of
panel cards in story order, each with its intent line as the card note, then a numbered overview
sheet. `devOnly: true` until the LTX 2.5 release (umbrella MPI-1267).

## Shape — the only DRIVER Flow

- **No graph, no workflow.** `driver: 'storyboard'` makes the frame's Generate (`MpiBaseFlow._run`)
  call `FLOW_DRIVERS.storyboard` (`js/shell/storyboardDispatch.js`) instead of
  `submitFlowGeneration`. Each panel is an ordinary FLUX.3 Klein generation built by the agent's
  `buildGeneration`: `edit` with the pictures as references (renumbered from `inputImage`), `t2i`
  without; `ratio`/`qualityTier` turn Custom size on, so an edit keeps the video's shape.
- **`flowStoryboard` op = slots only.** Registered in `commandRegistry.js` (and both op registries)
  for its ten optional image slots, because every Flow-media reader asks the op. Nothing dispatches
  it, and it has no `universal_workflows.js` entry. Package validation and the smoke set skip
  driver Flows.
- **Order lives in the pure runner** (`js/services/storyboardRunner.js`, `tests/storyboard-runner.test.cjs`):
  every job first, then the stack (the settle drops an empty filling stack); notes on landing;
  `reorderStack` to panel order once every job ends; the overview through `sheet.make`
  (`numbered`, `whole`). A failed panel leaves no card; a stopped run is ordered but gets no sheet.
  The end is a status-bar line naming any failed panel.

## The plan

- Enhance (`from: positive, panelCount, ratio`, `to: plan`) runs `STORYBOARD_PLAN_ENHANCE_PARAMS`
  (flowsRegistry.js). **DRAFT, unbenched**: Phase 0 tests it on the enhancer.
- The enhancer flattens its answer to one line, so `parseStoryboardPlan` splits on `[PANEL n]`
  and `Intent:`, never on newlines. Generate with no parsable plan refuses and says to press Enhance.
- Each panel is drawn alone, so the planner repeats every character's full description in every
  panel; the user names what each picture shows ("picture 1 is the waitress").

## Agent

`agentOpens: 'run'`: Cosmo opens it ready to press. `buildFlow` (agent, connector, routines) refuses
it with `OPENS_FOR_USER`; a routine step refuses it with `NOT_BATCHABLE`. `docs/agent/flows.md` names
it only when the gate comes off (a release Cosmo cannot see a dev-only Flow).

## Open

No `preview` yet (placeholder tile) — Phase 2 `/mpi-flow-graphics`. Never run live on the GPU yet.

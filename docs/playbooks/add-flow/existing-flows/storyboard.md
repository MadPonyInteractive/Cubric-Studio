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
- **Shapes = the video models' (LTX_RATIOS): 16:9, 9:16, 21:9, 1:1** (Fabio, 2026-10-25: never offer
  a shape no video model takes). FLUX.3 has no 21:9: `WIDE_21_9` sends exact pixels (1568x672 /
  2240x960) over the named 16:9, which switches Custom size on.
- **Ten slots as a numbered tile grid** (`grid: true` on the media group, MpiBaseFlow
  `_buildSlotGrid`): ten full-size boxes overran the screen and pushed the info column down. Filled
  tiles plus one empty tile show; the number is the "picture N" the plan refers to.
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
  (flowsRegistry.js), benched in Phase 0 (`tasks/MPI-1231/validation.md`, 3 boards, 18 panels).
- The enhancer flattens its answer to one line, so `parseStoryboardPlan` splits on `[PANEL n]`
  and `Intent:`, never on newlines. Generate with no parsable plan refuses and says to press Enhance.
- **The cast is repeated by CODE, not the planner.** Each panel is drawn alone; told to repeat
  descriptions, the 4B wrote "the same waitress" from panel 2 on. The plan opens on `[CAST] Name:
  description ...`; `parseStoryboardPlan(plan, idea)` appends the line of every cast name a panel
  mentions. Editing one cast line changes every panel. A panel that says "him" gets no line.
- **Pictured characters come from the user's note under each picture** (a `pictureNotes` field:
  the plan step's left column shows the first step's pictures as cards with a note box each,
  because a plan saying "picture 2" meant nothing once the user could not see picture 2).
  `mapDeclaredValue` turns the notes into "Picture 1 is Bix, a grumpy hairless cat." sentences,
  numbered by SLOT; Enhance reads them as a source and the driver appends them to the idea, so
  Bix's line becomes "the grumpy hairless cat from the first image" (the planner cannot see the
  pictures and invented their looks). The frame persists the sentences, so a reopen reads them
  back (`readPictureSentences`); clearing a picture drops its note. The same sentence typed into
  the idea still works. A picture showing a second animal leaks it into the panels.

## Agent

`agentOpens: 'run'`: Cosmo opens it ready to press. `buildFlow` (agent, connector, routines) refuses
it with `OPENS_FOR_USER`; a routine step refuses it with `NOT_BATCHABLE`. `docs/agent/flows.md` names
it only when the gate comes off (a release Cosmo cannot see a dev-only Flow).

## Open

No `preview` yet (placeholder tile) — Phase 2 `/mpi-flow-graphics`. Never run live on the GPU yet.

# Storyboard (MPI-1231) — dev-gated

An idea in words, plus optional pictures of the cast and places (up to 10), becomes ONE stack of
panel cards in story order, each with its intent line as the card note, then a numbered overview
sheet. `devOnly: true` until the LTX 2.5 release (umbrella MPI-1267).

## Shape — the only DRIVER Flow

- **No graph, no workflow.** `driver: 'storyboard'` makes the frame's Generate (`MpiBaseFlow._run`)
  call `FLOW_DRIVERS.storyboard` (`js/shell/storyboardDispatch.js`) instead of
  `submitFlowGeneration`. Each panel is an ordinary generation built by the agent's
  `buildGeneration`: `edit` with the pictures as references (renumbered from `inputImage`), `t2i`
  without; `ratio`/`qualityTier` turn Custom size on, so an edit keeps the video's shape.
- **Panel model = a choosable slot, EDIT models only** (Fabio, 2026-10-25): FLUX.3 Klein (first,
  recommended) or Qwen-Image 2.1 (research/evaluation licence, its own gate). The driver reads the
  pick with `flowModelIds(flow)` (no graph, so no `modelParams`). Qwen takes 8 pictures (FLUX.3 10):
  more is refused with a toast before anything queues. Turbo is FLUX.3's (`hiddenWhen: { modelNot }`);
  the driver sends it only to a model with a turbo switch, since Qwen refuses one (INVALID_TURBO).
- **Shapes = the video models' (LTX_RATIOS): 16:9, 9:16, 21:9, 1:1** (Fabio, 2026-10-25: never offer
  a shape no video model takes). Neither panel model has 21:9: `WIDE_21_9` sends exact pixels (1568x672 /
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

- **Plan with Cosmo** (an enhance button, `from: positive, pictureNotes, panelCount, ratio`,
  `to: plan`) runs `STORYBOARD_PLAN_ENHANCE_PARAMS` (flowsRegistry.js), benched in Phase 0
  (`tasks/MPI-1231/validation.md`, 3 boards, 18 panels).
- **It runs on COSMO'S model, not the enhance pick** (`runsOn: 'agent'`, Fabio 2026-10-25): the
  agent's connection + `Storage.getAgentPrefs().model`, `/llm/enhance` with `job: 'agent'` (an empty
  pick -> the agent's recommended model; a row's `reasoningEffort` rides along). A small enhance
  pick (DeepInfra gemma-3-12b) broke the format. No connection, key or model -> `NO_AGENT`, a
  toast with "Open Remote". `busyLabel` sets the pressed text.
- **The answer opens on "Storyboard plan:", never on `[CAST]`**: DeepInfra blanks a gemma-3 reply
  that starts with `[` (read as a tool call; tokens still billed). `tests/enhance-opener.test.cjs`.
- The enhancer flattens its answer to one line, so `parseStoryboardPlan` splits on `[PANEL n]`
  and `Intent:`, never on newlines. Generate with no parsable plan refuses and says to press Plan with Cosmo.
- **The cast is repeated by CODE, not the planner.** Each panel is drawn alone; told to repeat
  descriptions, the 4B wrote "the same waitress" from panel 2 on. The plan opens on `[CAST] Name:
  description ...`; `parseStoryboardPlan(plan, idea)` appends the line of every cast name a panel
  mentions. Editing one cast line changes every panel. A panel that says "him" gets no line.
- **Pictured characters come from the user's note under each picture** (a `pictureNotes` field:
  the plan step's left column shows the first step's pictures as cards with a note box each,
  because a plan saying "picture 2" meant nothing once the user could not see picture 2).
  `mapDeclaredValue` turns the notes into "Picture 1 is Bix, a grumpy hairless cat." sentences,
  numbered by SLOT; Enhance reads them as a source and the driver appends them to the idea. The
  frame persists the sentences, so a reopen reads them back (`readPictureSentences`); clearing a
  picture drops its note. A picture showing a second animal leaks it into the panels.
- **Every picture is DESCRIBED before Cosmo plans, note or no note** (Fabio 2026-10-25; the note
  is who it is and its part, never its looks). Blind, the planner drew "Sphinx" as the monument and
  gave a tiger noted "the protector warrior" arms, on both panel models. The button's
  `describePictures: { field, ask }` makes the frame (`_sourceWithPictures`) run
  `flowEnhance.describePictures` first: one queued describe per picture on the Remote describe
  pick (queue row + Stop), the button reading "Looking at picture N of M…", answers cached per
  picture + question. The planner gets "Picture 1 is NOTE. It shows LOOK." (`pictureSentences(notes,
  looks)`, the planner input only; the saved value stays the notes) and copies LOOK into that
  cast line: "Sphinx: a hairless grey cat ... from image 1". A failed describe is a warning naming
  the picture, and Cosmo is not called. After the plan lands an info toast says the cost per
  picture (`picturesCostLine`: DeepInfra's own price, "at no cost" on ComfyUI, or "described before").
- **The plan's cast line wins** over the note's "Picture N is NAME, a WHAT." line for the same name
  (it carries the description and the user's edits); the note's line only fills a pictured name
  the plan lacks (a hand-written plan). The note's article is dropped ("The Sphinx" -> `Sphinx`)
  so the two share a key.
- **A recurring actor with no picture gets one drawn first** (Fabio 2026-10-25: a dragon in words is
  a new dragon every panel; a ledge a new ledge). `recurringActors(plan, idea)` = `[CAST]`, `[PLACES]`
  and `[OBJECTS]` lines with no picture that 2+ panels name, as `kind` character > place > object,
  most-named first, capped at `MAX_DRAWN_FIRST` (4) or the model's free reference slots, whichever is
  fewer (the rest stay words, the status line says which limit). A crowd or swarm is never cast (the
  planner keeps it in words: "Bats" drawn alone on grey, 2026-10-25). Another name is no mention
  ("Bat Cave Interior" is not "Bat Cave Entrance"), and a name may hold "the" ("Cliff Over the River").
  The driver draws them (`t2i`; a character or object 1:1 on plain grey, a place empty at the video's
  ratio, both in the panels' style, `panelStyle`) into their OWN stack "<name> · Cast"
  (`sheet: false`, no overview), then queues the panels as `edit` with those pictures after the
  user's; `parseStoryboardPlan(plan, idea, actorImages)` ends that cast line "from image N". A failed
  actor picture is a warning and the panels describe it in words; Stop during the cast draws no panel.
- **A Picture never describes a cast member's looks** (planner rule, 2026-10-25): DeepSeek wrote
  "Fox (a small, bright-orange fox)" for a purple fox in picture 3, fighting the cast line.

## Agent

`agentOpens: 'run'`: Cosmo opens it ready to press. `buildFlow` (agent, connector, routines) refuses
it with `OPENS_FOR_USER`; a routine step refuses it with `NOT_BATCHABLE`. `docs/agent/flows.md` names
it only when the gate comes off (a release Cosmo cannot see a dev-only Flow).

## Open

No `preview` yet (placeholder tile) — Phase 2 `/mpi-flow-graphics`. Never run live on the GPU yet.

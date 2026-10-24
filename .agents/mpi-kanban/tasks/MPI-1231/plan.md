# MPI-1231 Storyboard Flow (LTX 2.5 release, dev-gated)

## Current State

- 2026-10-24 ("LTX 2.5 model 10"): design DECIDED (brief.md top section). Ships ALONE in the LTX 2.5
  release (umbrella MPI-1267); Keyframes (MPI-1191) left it. Research:
  `research/codebase-2026-10-24.md`. Nothing built. Depends on MPI-1268 (reorder + Create Sheet) for the
  final ordering and the overview; panel generation can start before.
- Shape: idea in words + OPTIONAL pictures of characters/places (zero or many) -> a planner writes N panels (a picture
  prompt + an intent line each) -> FLUX.3 Klein edit draws each panel from the references -> one STACK
  of panel cards in story order, each with its intent line as the card NOTE -> the numbered overview.
- 2026-10-24 ("LTX 2.5 model 12", no GPU): Phase 1 plumbing BUILT. Flow dev gate = `devOnly` on a
  FlowDef, filtered at the `FLOWS` export (`ALL_FLOWS`), `tests/flow-dev-gate.test.cjs` (both configs in
  child processes, mutation-checked). Driver = `js/services/storyboardRunner.js` `runStoryboard(panels,
  {name}, deps)`, pure like routineRunner; 7 tests. Deps NOT wired yet: the renderer side (submit via
  `submitFlowGeneration` + `runLanding`, addStack, update-meta note, `reorderStack`, `/combine-images`
  numbered+whole) lands with the FlowDef. A stopped run gets its order but no overview. NEXT: Phase 0
  (GPU) or the FlowDef via /mpi-add-flow. Planner `[PANEL n]` parser not written (Phase 0).
- 2026-10-24 ("LTX 2.5 model 12", no GPU): FLOW WIRED, devOnly. `driver: 'storyboard'` on the FlowDef ->
  MpiBaseFlow `_run` calls `FLOW_DRIVERS` (`js/shell/storyboardDispatch.js`); panels are plain FLUX.3
  Klein gens via agent `buildGeneration` (edit w/ refs, t2i without). `flowStoryboard` op = slots only.
  `parseStoryboardPlan` + DRAFT planner `STORYBOARD_PLAN_ENHANCE_PARAMS`. buildFlow refuses
  (`OPENS_FOR_USER`), routines refuse. Full suite green; modules load in an isolated page (age gate
  not clicked: Fabio's consent). NOT run live (GPU). Doc: existing-flows/storyboard.md. NEXT: Fabio
  looks at the Flow in his app (dev), then Phase 0 on the GPU (planner + panels).
- 2026-10-25 ("LTX 2.5 model 12", Fabio's first look): shapes = LTX's 16:9 / 9:16 / 21:9 / 1:1 (21:9 as
  exact pixels `WIDE_21_9`, built + checked in an isolated page); ten slots -> `grid: true` numbered tile
  grid (MpiBaseFlow `_buildSlotGrid`), which should also stop the info column being pushed down. 208f9ccd0.
  NOT SEEN on screen (isolated copy stops at the 18+ gate; never click it). NEXT: Fabio's look, then Phase 0.

## Phase 0: Panel recipe - `user-ux` (local GPU, Fabio's yes; no money)

- [ ] Planner system prompt on `/llm/enhance` (routes/llm.js:390) returning `[PANEL n]` blocks (picture
  prompt + intent line), parsed in JS; tested through the enhancer harness on the user's default LLM.
  Then 2-3 storyboards drawn by hand-run FLUX.3 Klein `edit` (up to 10 references, `multiReference10`)
  at the video's ratio (send ratio / Custom size: output otherwise follows picture 1). **Verify:**
  cast stays consistent across 6 panels; panels read as one scene in order; Fabio's eye. Record in
  `validation.md`. Fail -> try Qwen-Image 2.1 / Klein 9B before building.

## Phase 1: Flow - `auto`, then `user-ux`

- [x] **Flow dev gate (new, small):** no Flow gate exists today (`FLOWS` returned whole by `listFlows`,
  flowsRegistry.js:539/:2963). Add `devOnly` on a FlowDef, filtered like plugins
  (`pluginsRegistry.js:174`) on `APP_CONFIG.dev_mode`. **Verify:** unit test, a devOnly Flow is absent
  from `listFlows` in a release config. (Source: `tasks/MPI-1191/research/flow-machinery.md`.)
- [ ] FlowDef via `/mpi-add-flow`, `devOnly: true`:
  one step: the idea (text), reference pictures (media group `upto`), video ratio, panel count, an
  editable plan box filled by Enhance (like Character Sheet's enhanced prompt), Generate.
- [ ] Storyboard driver (client, `js/services/`): one stack id, N `submitFlowGeneration` with
  `runLanding {batchId, batchLabel, batchTotal, stackId}`, `addGroup(resultStackFields)` AFTER the first
  job (the settle drops a stack with no live job), loop-armed guard as in `_runStack`, panel index kept
  per card (`flowInputs`). One collapsed queue row with Cancel all; every end visible.
- [ ] On each completion: write the intent line as the item note (`POST /project-media/:id/update-meta`,
  only for a real item id). On settle: `reorderStack` to panel order (MPI-1268), then Create Sheet's
  numbered overview (MPI-1268) as its own card. A failed panel leaves its gap visible, not hidden.
  **Verify:** `npm run lint` + `npm test` (driver unit tests: order after interleaved arrival, a failed
  panel, cancel); `npm run app:isolated`: a 6-panel board lands as one stack in order with notes and an
  overview; Fabio's look.

## Phase 2: Launch kit - `user-ux`

- [ ] `/mpi-flow-graphics` (tile + hero), agent knowledge page (playbook 07), UNRELEASED roster line +
  entry for the LTX 2.5 release (written when the gate comes off, umbrella MPI-1267).

## Decided (Fabio 2026-10-24, took every pick)

- **Reference pictures are OPTIONAL: zero or many.** With none, panels are drawn from the words alone
  (text-to-image arm, e.g. FLUX.3 / Klein t2i, cast consistency then rests on the planner's
  descriptions; bench it in Phase 0 too). With some, the edit arm (up to 10 references).
- Panel count: default 6, slider 3-12.
- Show the plan before drawing: an editable box of panels that Enhance fills.
- The numbered overview is made automatically at the end.
- Phase 0 go-ahead given (local runs, ~20-30 min GPU under the lease; no money).

## Not in v1

Sections, a video per section, Generate for missing sections, Keyframes, Cosmo tools for stacks/notes
(none exist today: a later card if Cosmo should call this Flow).

## Plan Drift

- 2026-10-24: brief's open questions answered by the brainstorm (stack + notes, not a new card kind).

## Verification

**Verify mode:** user-ux

Phase 0 and the end of Phase 1 need Fabio's eyes; the driver self-verifies with unit tests.

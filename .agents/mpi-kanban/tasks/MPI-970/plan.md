# MPI-970 Plan: Routines - the agent saves a chain once, the app runs it on any card in one call

## Current State

2026-09-30 (7026c025, Agent 71) - **Fabio said yes to the dropdown with every pick: D13, Phase 6.** Card back to
in-progress. **U1-U3 DONE, uncommitted**, `npm test` 2383 / 0, live in an own isolated app (validation.md).
- U1 `routineChoice` (runner, pure) -> greyed reasons: needs an input / wrong kind / "Not ready here: needs X" (not
  "not installed": a cloud model's check reads "X (no cloud key set)").
- U2 `routineDispatch.js` `readSavedRoutines` / `routineMenu` / `runSavedRoutine`; the bar's `MpiDropdown` (options
  rebuilt only on change, the sync runs every render); grid `setRoutineMenu` + `routine` event; the block reads the
  lists on `selection-start`. Tool description kept ("you run one" is still true).
- U3 Routines rule now "run on any cards by you or from Routines on the gallery selection bar"; guide says the bar is
  the only place and greys input routines; bench `routine-save` now fails a reply naming a right-click / card menu.
- U4 round 1 (Fabio): dropdown too wide on 1920 px; rename left a copy; agent "cannot delete routines". All three
  FIXED, uncommitted, `npm test` 2390 / 0 (details: validation.md, Plan Drift). New: tool `rename` action.
- U4 round 2 VERIFIED by Fabio ("Okay, this works": his agent deleted the duplicate; the dropdown is label-sized).
- MOVE built (Fabio's yes): tool `move` takes no direction (out of the project if there, else out of the global ones;
  `scope` ignored, a model puts the destination there), store `moveRoutine` writes the other scope first then sends
  the source to `deleted/`. Uncommitted until the handoff; `npm test` 2392 / 0; live in an own isolated app
  (validation.md). SYSTEM 10,460 / 10,470, TOOLS 18,239 / 18,250.
**Next (fresh session):** Fabio's look at move in his app (restart it; "make <routine> available in all my projects",
then back; Routines on the selection bar lists it either way). Rename not yet seen in his app. Optional paid bench
routine-rename/-move/-delete/-save (DeepSeek, 4 cases x (3 + flip) = 16 conversations, about 3 cents) on his yes; his
agent runs on Ollama (model unknown: ask for a free `--preset ollama` run). Then close-out (`mpi-end-session`). Noticed: a refusal shown to
the user can carry agent words (the downscale one ends "Enlarging is imageUpscale.").

2026-09-30 (8cbb0199, Agent 70) - **W2, W3, D12 and F1 DONE.** Uncommitted, `npm test` (Git Bash) 2382 / 0. Landed:
- W2 `services/agentLoop.mjs` `routine` tool + `_routine`: list (both scopes), save (gated on `app:routines`), run
  (quote -> `NOT_INSTALLED` by name -> ONE `_confirmSpend` card -> held run, 1 s refusal race -> ONE `[Routine
  finished]` note via `_routineNote`; `_routineRuns` holds the drain; local engine = GPU job), delete. `_askSpend`
  split: `_confirmSpend` is the card. Loopbacks `listRoutines/saveRoutine/deleteRoutine/quoteRoutine/runRoutine` in
  `agentTools.mjs`, allowlisted in `agent-no-delete`. **Root-cause fix:** saved steps are in the CONNECTOR's words
  (`positive`), the agent writes generate's (`prompt`) -> an unknown key silently dropped. generate's body mapping is
  now `_generateFields`, used by both (`agent-denoise` / `agent-duration` source pins repointed). `TOOLS_BUDGET`
  17,300 -> 18,250 (measured 18,198, +949). Test `tests/agent-routine-tool.test.cjs` (7, gate mutation goes red).
- W3 `docs/agent/routines.md` (145 lines) -> `- app:routines: Routines` in the system prompt, 10,227 / 10,250.
- D12: no capability summary exists anywhere (the agent answers "what can you do" from its rules). First put in the
  tool description: B1 failed it 0/3. Now the system prompt's `Routines rule` (+114 bytes, SYSTEM_BUDGET 10,250 ->
  10,390, reason in the comment); the tool clause removed (TOOLS_BUDGET 18,210, measured 18,162).
- LIVE (own isolated app :56034, never :3000; :48188 engine under gpu_lease, queue empty): the REAL loop + REAL
  loopbacks, no LLM (scratchpad `w2-live.mjs`): list, save refused then saved through the renderer's check, run on 2
  cards -> note "2 new cards in the new stack ..." + `agent:drained`, delete, list clean; disk: stack of 2, 2
  versions each.
- F1 `docs/routines.md` (146 lines) + rows in `docs/README.md`, `docs/agent-chat.md`, `docs/stacks.md`, the knowledge
  index; every path it names exists.
- B1 BUILT, NOT RUN: `services/agentBench.mjs` fake routine tools (a save goes through the REAL `validateRoutine`)
  + 5 cases `routine-list`, `routine-save`, `routine-run` (a dropped set of 3 -> ONE run over all 3, no generate),
  `routine-delete` (only the one asked), `routine-in-capabilities` (D12). Free dry run with a SCRIPTED model
  (scratchpad `b1-dry.mjs`): all 5 pass on correct behaviour, the run flip fails. Suite hash changes, so stored
  scores read "(older tests)".
- B1 RUN (Fabio's yes, 20 conversations, DeepSeek-V4-Flash-0731, $0.0359): routine-list / -save / -run / -delete
  3/3 each; routine-in-capabilities 0/3 with D12 in the tool description -> moved to the system prompt (above);
  `--bite` all 5 flips fail as they must. Re-run after the move (Fabio's second yes): routine-in-capabilities 3/3,
  $0.0015. B1 total $0.0374 for 23 conversations.
- F2 round 1 (Fabio, 2026-09-30, his app on Ollama): save (gate -> read -> save), rename, run on a stack of 4 -> 4 new
  cards + one finished note all WORKED. Two faults: (1) the agent told him "select any image card in your gallery and
  run the routine" - no such UI exists; (2) "rename" saved a copy, the old `crop-to-916-and-upscale-2x` still exists.
  Uncommitted fix made before he redirected: Routines rule now "steps saved once that YOU run on any cards. The app has
  no routine button; never tell the user to run one." (SYSTEM 10,388 / 10,390), tool description "you run one", guide
  says only the agent runs one + rename = save new then delete old; bench `routine-save` fails a reply telling the user
  to run it themselves. `npm test` 2382 / 0. NOT re-verified live.
- **Fabio's proposal (2026-09-30, answer it FIRST next session):** a dropdown in the gallery SELECTION toolbar (the
  bar that replaces the prompt box on multi-select, `docs/gallery-selection.md`) listing the saved routines; pick one
  = run it on the selected cards. Only the agent creates routines for now. Everything needed exists: the renderer
  runs routines (`ROUTINE_HANDLERS` / `runRoutine`), the list is `GET /connector/routines`. It reverses D8's
  "agent-free entry point is a separate card". Give him an opinion (my lean: yes - small, the run path is done; open
  points: a paid routine needs the same one-price confirm as the agent's spend card, inputs (D9) need a way to be
  filled or such routines are hidden from the dropdown, project + global lists merged). If he says yes, the "no
  routine button" wording above must change to point at the dropdown (or go). Fabio, same exchange: a UI for the user
  to CREATE / delete routines is for 2.1, perhaps - not this card.
- Noticed (not this card): in "what can you do" the agent claimed "composite and transform tools", which its Honest
  limits say it cannot use. Pre-existing.
**Next:** answer the dropdown proposal; then either build it (UI: user-ux) or keep the wording fix; then F2 again. Open ceilings (ponytail, in the code): a routine run is not cancellable from the chat;
an all-cloud routine still waits a local agent; `list` gives a step COUNT, so "change routine X" re-saves from scratch.

2026-09-30 (bd66b68e, Agent 69) - **D10 built, R2 DONE, W1 routes DONE (loopbacks moved to W2).** Uncommitted,
`npm test` 2375 / 0. Landed:
- D10 in `routineRunner.js`: `_nothingToDo(sub)` (`ALREADY_SMALLER` only, ponytail) from `submit` = skip. Step 1 skipped
  -> the next step is submitted with gallery landing (makes the new card, joins the stack; `expected` counts it); a
  later skip -> no version, next step on the same file. Row gains `skipped: [stepNumbers]` (absent when none); `steps`
  = versions that landed; summary `ok` = some card made a result without failing. Nothing to do on every card ->
  refusal with the skip's code, "no step had anything to do".
- R2 `routineDispatch.js` `ROUTINE_HANDLERS`: `routine.validate` (save-time check HERE: package Flows exist only in the
  renderer's `FLOWS`), `routine.quote` -> `{ missing, billed, count, usd, display }`, `routine.run` -> answers once
  `finished` settles with the summary. Input `{ routine, cards, inputs?, folderPath? }`; a stack id in `cards` expands
  to its members (`expandStacks`). Registered in agentDispatch `_HANDLERS`, looked up at call time (import cycle).
  **Fixed:** `readProject` hydrates a CLOSED project (`reconcileAndHydrate`) - raw `/get-project` history is item ids.
- W1 `routes/connector.js`: `GET /connector/routines[/:name]`, `POST /connector/routines` (relay validate, store AS
  CHECKED, answers `summary`; `delete: true` rides the POST like memory), `POST /connector/routines/:name/quote|run`
  (read the stored routine, relay). `scope=global`. Store list now has `inputs`. Test `tests/connector-routines.test.cjs`.
**Next: W2** - loopbacks in `services/agentTools.mjs` (none written yet: shape them to W2's calls), the `routine` tool
in `agentLoop.mjs` (quote -> `_askSpend` once -> run held like a slow generate -> `[Routine finished]` note naming
skipped/failed steps per card), then W3 guide + D12 capability line.

2026-09-30 (d46a8d69, Agent 68) - **D9 built, R1 DONE (wiring + live run).** Uncommitted. Landed:
- T1 `routineModel.js`: `inputs: [{ id, kind: image|video|audio|text, label? }]`; a step's `media` may only be
  `[{ role, input }]` naming a declared input in a NON-required slot of its kind (a `url`/`path` = `STEP_HAS_MEDIA`);
  `{id}` in `positive`/`negative`/Flow field strings must be a declared TEXT input; an unused input is refused. One new
  code `INVALID_INPUT`. `routineSummary` ends `; needs <id> (<kind>, <label>)`. Exported `ROUTINE_PLACEHOLDER`.
- Runner: `runRoutine(..., { projectFolder, inputs })` resolves inputs ONCE (card id -> its selected file, else a
  path by extension; text as given), refuses `INPUT_MISSING` (`missing: [ids]`) / `INVALID_INPUT` before queueing,
  hands `submit` a FILLED step (`media: [{ role, url }]`, placeholders replaced). `quoteRoutine(r, n, deps, inputs)`
  refuses `INPUT_MISSING` too (never ask to pay for a run that cannot start). No stack for an audio result.
- `agentDispatch.js` split: exported `buildGeneration(input, project, { pinned, painted })`, `buildTool(input,
  project)`, `buildFlow(input, project)` (refusals `{ ok:false, code, message }`), plus `galleryPlaceholder()`;
  the agent submits are thin wrappers (pin, mask, follow stay agent-only). **Breaker fixed:** `resolveSettingsOwner`
  dropped `denoise`, so an agent's denoise silently ran the op default; now forwarded (test in
  `agent-pinned-settings`). Source-pinned tests repointed: `agent-mask-dispatch`, `flow-gallery-placeholder`.
- `js/shell/routineDispatch.js`: `routineDeps` (check / price / readProject / submit / addStack / newId). Closed
  project: stack POSTed to `/project-groups`, whose upsert joins each landing result to `members`.
- LIVE (own isolated app, :48188 engine under gpu_lease, queue empty): routine downscale(0.2 MP) -> klein-4b
  kleinEdit (character card in `inputImage2`, `{mood}`) -> Scribble Flow on 2 cards = 1 settled stack of 2, each card
  3 versions (resize, edit, flowScribble), disk == live, inputs untouched, 71 s; the edit sidecar shows the filled
  prompt and the character as `inputImage2`. A first run at 0.5 MP stopped card B at step 1 (`ALREADY_SMALLER`,
  512x640) = D3 working; the stack then held 1.
**Next: R2** - relay `routine.quote` / `routine.run` capabilities in `routineDispatch.js` (register beside
`generation.submit` in `initAgentDispatch`'s switch, or its own listener), then W1 routes. The run's `stackId` input
(D9 "scenes as a STACK") is R2/W2's `expandStacks`. **Decided by Fabio 2026-09-30 (took my picks):** see D10-D12.

2026-09-30 later (26163994, Agent 67) - **R1 core DONE, R1 wiring NOT started.** Uncommitted, `npm test` (Git Bash)
2347 pass / 0 fail. Landed:
- `js/services/routineRunner.js`: `quoteRoutine(routine, cardCount, deps)` -> `{ ok, missing[], billed, usd|null }`;
  `runRoutine(routine, cardIds, { projectFolder }, deps)` -> refusal, or `{ ok, runId, stackId, finished }` once every
  step 1 is queued (`finished` = `{ ok, runId, stackId, cards: [{ inputGroupId, groupId, steps, failedAt?, error? }] }`).
  Pure: ALL app access is `deps` (`lookups, check, price, readProject, submit, addStack, newId`, typedef at the top).
  `submit(step, {url, mediaType}, landing, project)` must resolve once ENQUEUED to `{ ok, done }`; `landing` = the
  run's `{ batchId, batchLabel, batchTotal, stackId? }` plus `existingGroup` on a later step. Refusal codes:
  `NOT_INSTALLED` (+`missing`), `NO_CARDS`, `PROJECT_NOT_FOUND`, `CARD_NOT_FOUND`, `WRONG_MEDIA_TYPE`, T1's codes.
  `tests/routine-runner.test.cjs` (9): order, D2 new card, versions, stack after all step 1s + stackId on every step,
  D3 fail/cancel, step-1 refusal, CARD_GONE, up-front refusals, quote, and the flowService passthrough.
- T1 `validateRoutine` also returns `outputKind` (last step's): the result stack's `kind`.
- `js/services/flowService.js`: run-only `runLanding` (stripped from the sidecar snapshot, forwarded to leg 2 via
  `inputs` and to every `runNextPass` pass); `existingGroup` -> groupHistory opts, else gallery opts + the landing.
  Two pinning tests updated for the new run-only key (`agent-target-project`, `flow-enhance-ownership`).
- BREAKER FIXED on the way (generationService.js, MPI-839 regression): a History completion re-read its card from the
  ENQUEUE-time project snapshot, so a second History job queued on one card dropped the first job's version (and a
  pick/rename made meanwhile was undone). Now `_originLive()` = live project while the origin is open. Test
  `tests/history-completion-live-card.test.cjs`. Closed origins still read the frozen copy (ponytail in the code).
**Next: D9 first (run-time inputs, see Decisions), BEFORE the wiring** - T1 `STEP_HAS_MEDIA` becomes "media only as
`{ role: <reference slot>, input: <declared id> }`", plus `inputs[]` validation and `{id}` prompt placeholders; the
runner takes `opts.inputs`, refuses `INPUT_MISSING`, and hands each step its resolved extra media/prompt through
`submit`; tests for both. Then **R1 wiring:** (1) split `agentDispatch.js` `_submitGeneration`/`_submitTool`/`_submitFlow` into exported
BUILD halves (no pin, no mask, no follow for a routine; project null for named params) + their enqueue; (2)
`js/shell/routineDispatch.js` = the renderer `deps`: `check` (isOperationInstalled / hasCloudKey / flowAvailability,
names), `price` (estimateRunCost), `readProject` (open -> `state.currentProject`, closed -> `/get-project`),
`submit` (build + enqueue with `_originProject` = the passed project and the landing: gallery placeholder for step 1,
Flow via `runLanding`), `addStack` (`createItemGroup(STACK_TYPE, resultStackFields(...))` with the runner's id;
closed project -> server-side); (3) the live 2-card x 3-step run in an own isolated app (rig in § Phase 1 notes above).
**Your call pending (Fabio):** an image->video routine lands the clip as a video VERSION inside the image result card
(the open-card History rule of MPI-890 allows it) and the stack kind follows the LAST step; say if a kind change
should start a new card instead.

2026-09-30 (session 26163994, Agent 67) - **Foundations batch DONE** (T1 + T2, uncommitted, claims `complete`).
`node --test tests/routine-model.test.cjs tests/agent-routines-store.test.cjs` 44/44; `npm test` (Git Bash)
2336 pass / 0 fail / 2 skipped. **Next: R1 `js/services/routineRunner.js`** with the Phase 1 findings below as its
spec. What R1/W1 need from the batch:
- T1 `js/data/routineModel.js`: `normalizeRoutine(raw)`, `validateRoutine(routine, { models: MODELS, flows: FLOWS })`
  -> `{ ok, routine, inputKind }` | `{ ok:false, code, message }` (codes: `INVALID_ROUTINE`, `TOO_MANY_STEPS`,
  `STEP_HAS_MEDIA`, `UNKNOWN_MODEL`, `UNKNOWN_OPERATION`, `UNKNOWN_FLOW`, `INVALID_FIELD`, the `resolveNamedParams`
  codes, `NOT_BATCHABLE`, `MEDIA_KIND_BREAK`), `routineSummary(routine)`. Tools come from `AGENT_TOOL_OPS` directly,
  not `lookups`. Imports cleanly in plain Node. `inputKind` = step 1's one required kind (R1 checks input cards).
- T2 `services/agentRoutines.mjs` (agentMemory's shape, throws `RoutineError{code}`): `listRoutines/readRoutine/
  writeRoutine/deleteRoutine(folderPath, ...)` + `listGlobalRoutines/readGlobalRoutine/writeGlobalRoutine/
  deleteGlobalRoutine`; dirs `<project>/Agent/routines/`, `<APP_USER_DATA>/agent/routines/`; codes `INVALID_NAME`,
  `BAD_REQUEST`, `NOT_A_PROJECT`, `ROUTINE_NOT_FOUND`, `ROUTINES_FULL`. A second delete of one name keeps both
  copies (older one gets a `-<ms>` suffix).

2026-09-29 (session c4eb2969, Agent 66) - card in `doing`, `files.json` written. **Phase 1 DONE: S1, S2, S3
all passed live** (below). Next was the Parallel Batch Foundations (done 2026-09-30, above), then R1 with
the findings below as its spec. Spike rig (scratchpad, not repo): own Electron with own
profile/port/APP_DOCUMENTS under `%TEMP%/c970` plus `--remote-debugging-port=9370`, driven by
`playwright-core connectOverCDP` + `page.evaluate`; real engine root (pins checked clean), jobs under
`gpu_lease.py run`, on Fabio's :48188 engine (queue checked empty before each run, no cancels).

### Phase 1 findings
- **S1 (2026-09-29):** step 1 = `enqueueGeneration(config, cb, { scope:'gallery', tempId, placeholderGroup })`
  on card A made NEW card B, A untouched. Each later step = input B's newest file +
  `{ scope:'groupHistory', existingGroup: B, groupId }` landed as B's next version, `selectedIndex` on it,
  `project.json` agreeing: resize(downscale) -> resize(crop) -> imageUpscale -> klein-4b i2i -> Scribble
  Flow = 5 versions (screenshot `shot-s1-history.png`, scratchpad). Every op kind can be step 1 AND a later step.
- **Correction:** `crop`/`downscale` are NOT engine-free: every agent tool op is a ComfyUI universal op
  (`resize`, `imageUpscale`, `removeBackground`). Each costs well under a second, still on the engine.
- **A Flow cannot be a later step today:** `submitFlowGeneration` (`js/services/flowService.js` ~261) hard-codes
  gallery opts. Proven with an in-page patched copy (disk untouched): passing `existingGroup` through its one
  `enqueueGeneration` call made the Scribble result B's version 5. R1 adds that passthrough as a run-only input
  (like `runOriginProject`; flowService.js joins this card's files). **Every Flow may be any step** (Fabio
  confirmed 2026-09-30: some of our own Flows become multi-part after 2.0): a two-leg (`flow.chain`) or multi-pass (`runNextPass`) Flow forwards the same input to each
  leg/pass, so each lands as one more History version. No shipped Flow chains or multi-passes today (Outpaint
  fills in one pass since MPI-900); a package Flow could.
- **A model step with no `ratio` takes the model's default ratio, not the input's:** klein-4b i2i on a 1:1
  input came out 1088x896 (5:4). Same as today's agent `generate`; the guide (W3) must tell the agent to carry
  `ratio` in each step. Decided (Fabio, 2026-09-30): the guide, no runner magic.
- **Opts to use:** the runner calls `enqueueGeneration` itself with explicit opts; it must NOT reuse
  `_enqueueAgentRun`'s `workspaceGenerationOpts` (that versions whichever open card owns the input, so step 1
  would version A, breaking D2). Config building (named params, media, installed checks) should be shared with
  `agentDispatch._submitGeneration`/`_submitTool`/`_submitFlow` by splitting their build half from their enqueue half.
- **S2 - a closed project WORKS, no `PROJECT_NOT_OPEN` needed:** with `config._originProject` = the closed
  project's `/get-project` record, step 1 registered a new card there (`_addGroupsToClosedProject`) and step 2
  (`existingGroup` from a FRESH `/get-project` read) versioned it through `/project-groups`' upsert-by-id; the
  open project was untouched, and opening the closed one showed the card with both versions (reconciler kept
  it). Rule for R1: re-read the closed project before EVERY later step (the step-1 snapshot has no result card).
  `/get-project` history is item-id strings; `serializeGroup` accepts them.
- **S3 - result stack WORKS:** prepare every card's step-1 config, enqueue them all with `stackId`, THEN
  `addGroup(resultStack, expected: N)` (jobs first, as `_runStack`: the settle drops a filling stack with no live
  job). Carry `stackId` (+ `batchId`/`batchLabel`/`batchTotal`) on EVERY step, not only step 1: the
  `existingGroup` branch ignores it for membership, but it keeps the job live for `_settleResultStacks`, so the
  stack reads "filling" (`expected: 2`) until the last step of the last card, then settles itself; no explicit
  `settleResultStack` call needed. 2 cards x 3 steps: one stack of 2, members keep `stackId`, 3 versions each,
  disk agrees, inputs untouched (screenshots `shot-s3-gallery.png`, `shot-s3-stack.png`).

2026-09-29 (session 726c00ac) - planned. Fabio approved the plan and D1-D8 as written ("go ahead", same day).
Project mode: scalable-foundation.
Design approved by Fabio in the brainstorm: `brief.md` § "Brainstorm decisions". Verified code facts (two
investigator claims corrected): `research/findings.md`. Read both before any phase.

Shape in one paragraph: a routine is a JSON file (`cubric/routine/v1`) in `<project>/Agent/routines/` or the
global `<APP_USER_DATA>/agent/routines/`, holding a name, a plain-words summary and a list of steps, each step
the args of a `generate` call minus the input media. The in-app agent reaches it through ONE short `routine`
tool (`list` / `save` / `run` / `delete`); `save` is gated on reading `app:routines`. The RENDERER runs it
(`js/services/routineRunner.js`): each input card runs the whole chain on its own, step 1 makes a NEW card,
every later step lands as the next History version of that card (`enqueueGeneration(config, { existingGroup })`),
and N cards finish as ONE new stack (one card -> one new card, no stack). Before step 1 of any card, every
model and Flow is checked installed (else nothing runs and the agent names what is missing), and a paid step
asks the price ONCE for the whole run (steps x cards), as a batch does.

Why the renderer runs it: generation, stacks, History versions, the installed checks (`flowAvailability`,
`MODELS[].installed`) and the price (`estimateRunCost`) are all renderer-owned, and the later agent-free
overlay (a separate card) will call the same runner. The server holds storage and the agent loop; the run is
relayed like `generation.submit` (`_dispatchToRenderer`).

### Decisions front-loaded (scalable-foundation) - my picks, Fabio can overrule any
- D1 Steps take only the previous step's result (one media slot, the stack-run rule `selectCueAllTargets`).
  No fixed extra reference images in v1; add when a user asks for "edit with this character sheet" chains.
- D2 Step 1 always makes a NEW card; the user's input card is never versioned.
- D3 A step that fails or is cancelled stops THAT card's chain; its card keeps the versions already made;
  other cards carry on; the finish note lists the failures.
- D4 Each card's chain is sequential; different cards run concurrently through the normal lanes (the queue
  already serialises one job per lane).
- D5 `delete` moves the file to `routines/deleted/` (one rename, recoverable), as forgotten notes do.
- D6 Caps: 50 routines per scope, 10 steps per routine (refusals `ROUTINES_FULL`, `TOO_MANY_STEPS`).
- D7 "Offer to save after the user repeats steps" is one short clause in the tool description (bytes counted),
  not a system-prompt rule.
- D8 Not in this card: MCP (outside agents), the agent-free entry point, fixed extra media (D1).
- **D9 (Fabio, 2026-09-30) - routines take INPUTS besides the card; this reverses D1's "no extra media" and D8's
  "fixed extra media" exclusion.** His case: "restyle these cards to match this image", as a stack run does it today
  (`buildCueAllJobItems`: the varied card in the op's one required slot, every other staged picture fixed). Shape (my
  pick, not yet confirmed in detail): the routine declares `inputs: [{ id, kind: image|video|audio|text, label }]`;
  a step references one - a media input by `media: [{ role: <an OPTIONAL/reference slot>, input: <id> }]` (the
  required slot stays the chained card/result), a text input by a `{id}` placeholder in the step's prompt; `run`
  takes `inputs: { <id>: <card id or file | text> }`, and a missing one refuses up front (`INPUT_MISSING`, named) so
  the agent asks. Validation at save: every referenced id declared, a media input only on a non-required slot of a
  matching kind. Saved default values (the "always this logo" case) are a later additive field. Scene RECIPES
  (steps from nothing, several earlier results by name) stay OUT of this card - a follow-up on the same file format.
  Fabio's worked example: "place a character in different scenarios" - the scenes come as a STACK (the varied cards,
  each into Klein Edit's required edited-picture slot), the character is the run input in its reference slot; result
  = one new stack, one card per scene. So `run` must accept a STACK id and expand it to its members
  (`expandStacks`, as `_runStack` does) - R2/W2. Open: a routine that must vary the REFERENCE slot instead (one
  subject, a stack of styles) needs a step to name the slot the card goes into (`card: <role>`); add if asked.
  **Limits (Fabio, 2026-09-30: "the whole point is chaining actions on an image or video - don't complicate it"):**
  ONE set of cards varies per run (a selection or a stack); every input is FIXED for the whole run, and a picture
  input is ONE picture. Two stacks in one run (e.g. 3 characters x N scenes) is refused, and the guide (W3) has the
  agent say so and offer the way that works: one run per character, or one character sheet holding all three as the
  single picture (Klein Edit has 2 reference slots beside the edited picture). No multi-picture inputs, no cross
  products. The agent reads routines through `list` (name, summary, steps AND the inputs each needs) and the guide
  explains what a routine can and cannot do.
- **D10 (Fabio, 2026-09-30):** a step that has nothing to do on a card (`downscale` on a card already under the
  target -> `ALREADY_SMALLER`) is SKIPPED for that card and the chain carries on with the same picture; it is not a
  D3 failure. NOT BUILT YET (R2 batch): in `routineRunner.js`, treat that refusal from `submit` as a pass-through -
  step 1 skipped means the NEXT step makes the new card (D2 still holds), a later step skipped means no version;
  the finish note lists skipped steps per card. Test it in `routine-runner.test.cjs`.
- **D11 (Fabio, 2026-09-30):** an image->video routine lands the clip as a video VERSION inside the image result
  card, and the stack kind follows the LAST step (as built). No change.
- **D12 (Fabio, 2026-09-30):** when the user asks the agent "what can you do for me", routines MUST be in the answer
  (save a chain once, run it on any cards). W2/W3: wherever the agent's capability summary lives (system prompt
  capability line / the corpus entry it reads for that question - find it first, `services/agentLoop.mjs` +
  `docs/agent/`), add routines there, bytes counted against the budget test.

## Completed

- [x] Brainstorm (Fabio, 2026-09-29): name, storage, stack-like run with History versions, dedicated tool.
- [x] Investigation: `research/findings.md`.

## Remaining Work

## Phase 1: Prove the run shape (spike, no product code kept unless it passes)

- [x] S1 In an own `npm run app:isolated` (never :3000), drive `enqueueGeneration` from the devtools console:
  a tool op (`imageUpscale`) on card A with GALLERY opts -> does it make a NEW card B (D2)? Then a model op
  (a cheap local image op, or a tool) whose input is B's newest file with `{ existingGroup: B }` -> does it land
  as B's version 2? Then a Flow step the same way. Record which op kinds can be step 1 (new card) and which can
  be a later step (version). The agent profile may have no engine or models: `crop` / `downscale` run without
  ComfyUI, so prove the mechanics with them first and a model op only if the profile can run one.
  **Verify:** B's `history.length` grows per step in `project.json`; screenshots.
- [x] S2 A project that is NOT open: can the runner version a card there (`_originProject` for a closed project;
  MPI-873 closed-project submits)? If not, the rule is "a routine runs in the open project" and `run` refuses
  otherwise with `PROJECT_NOT_OPEN` naming the project. **Verify:** the answer written into this plan's
  Current State with the evidence line.
- [x] S3 Stack of results: with 2 input cards, create the result stack up front (`expected: 2`), step-1 cards
  join it (`addGroupsToStack`), later steps version members (members keep their `stackId`), `settleResultStack`
  on the end. **Verify:** one stack card in the gallery holding 2 cards, each with N versions.

Phase 1 is sequential (one live app, one set of findings). It may rewrite Phase 3.

## Parallel Batch: Foundations (after Phase 1; the two share no file)

- [x] T1 Pure routine model + validator. Ownership: `js/data/routineModel.js`, `tests/routine-model.test.cjs`.
  Briefings: `dos_and_donts`, `root-cause`. Schema `cubric/routine/v1` `{ schema, name, summary, steps[],
  created_at }`; `normalizeRoutine`, `validateRoutine(routine, lookups)` where `lookups` injects the model,
  Flow and tool catalogues (no renderer state), checking per step: modelId+operation XOR flowId XOR a tool op
  (`AGENT_TOOL_OPS`); named params via `resolveNamedParams(null, ...)`; tool fields via `toolRun`'s checks
  (extract a pure helper if they are tangled with dispatch); the media-kind chain (step N's output kind must be
  step N+1's one required media kind, `selectCueAllTargets`); D6 caps; no `media`/`cards`/`count` inside a step.
  Also `routineSummary(routine)` = the plain-words line `list` shows. **Verify:** `node --test
  tests/routine-model.test.cjs` covers a legal 3-step chain, each refusal code, and an image->video->image kind
  break.
- [x] T2 Routine file store. Ownership: `services/agentRoutines.mjs`, `tests/agent-routines-store.test.cjs`.
  Briefings: `dos_and_donts`, `root-cause`. Modelled on `services/agentMemory.mjs`: `listRoutines(folderPath |
  global)`, `readRoutine`, `writeRoutine` (atomic write, slug `^[a-z0-9][a-z0-9-]{0,60}$`, overwrite = same
  name), `deleteRoutine` (D5 move); project dir `<project>/Agent/routines/` refuses a folder with no
  project.json (`NOT_A_PROJECT`); global dir beside the global notes; caps (D6). Takes an ALREADY-validated
  routine: validation is wired in Phase 4. **Verify:** `node --test tests/agent-routines-store.test.cjs` in a
  temp dir: write/list/read/overwrite/delete both scopes, the caps, a bad slug, a non-project folder.

Run this batch with `mpi-execute-parallel` (disjoint files, per-task verify, no intra-batch dependency).

## Phase 2: The runner (renderer)

- [x] R1 (2026-09-30, D9 + wiring + live run: § Current State) `js/services/routineRunner.js`: `quoteRoutine(routine, cards)` -> `{ missing[], usd, display }`
  (installed checks per step: model installed / cloud key / `flowAvailability`; price = sum of
  `estimateRunCost` x cards); `runRoutine(routine, cards, { projectFolder })` -> starts, returns `{ runId }`,
  per card runs the steps in order awaiting each job's `onComplete`, step 1 new card (into the result stack when
  N > 1), later steps `{ existingGroup }`; D3 failure/cancel handling; emits one completion with
  `{ ok, cards: [{ groupId, steps, failedAt?, error? }], stackId }`. Re-validates with T1 before running (a model
  update can make a saved setting illegal). Phase 1's findings decide the exact opts. **Verify:** unit test with a
  stubbed `enqueueGeneration` (order, versioning opts, stack membership, a mid-chain failure, a cancel) +
  one live 2-card x 3-step run in an own isolated app.
- [x] R2 (2026-09-30, + D10, live over the connector: § Current State) Relay capabilities in the renderer: `routine.quote` and `routine.run` beside `generation.submit`
  (`js/shell/agentDispatch.js` or a new `js/shell/routineDispatch.js` if agentDispatch is claimed); the run's
  completion posts back like a slow generate (`POST /connector/jobs/:id/result`). **Verify:** a connector call
  from a scratch script to the own isolated app runs a saved routine and gets the result back.

## Phase 3: Agent wiring (server)

- [x] W1 (routes DONE 2026-09-30, bd66b68e; loopbacks done in W2, 8cbb0199) Routes in `routes/connector.js`: `GET /connector/routines[?scope=global]`, `GET /connector/routines/:name`,
  `POST /connector/routines` (validate with T1, store with T2), `DELETE /connector/routines/:name`,
  `POST /connector/routines/:name/run` (relays `routine.quote`, then `routine.run`). Loopbacks in
  `services/agentTools.mjs`. **Verify:** route tests beside the existing connector tests.
- [x] W2 (2026-09-30, 8cbb0199, + live through the real loop: § Current State) `routine` tool in `TOOL_DEFS` (`services/agentLoop.mjs`): `{ action: list|save|run|delete, name,
  scope, summary, steps, cards }`; description SHORT and plain (Fabio), target ~350 bytes including D7's clause;
  `save` refused with `KNOWLEDGE_NOT_READ` until `app:routines` is read (`_readIds` / `_gateWaiting`); `run`
  answers the missing list as a refusal naming each model/Flow, asks `_askSpend` ONCE when the quote has a price,
  then returns running and posts a `[Routine finished]` note on completion (like `[Batch finished]`). Raise
  `TOOLS_BUDGET` by the measured amount only, with the reason in the constant's comment. **Verify:**
  `node --test tests/agent-prompt-budget.test.cjs` + a loop unit test for the gate, the missing refusal, the one
  spend ask.
- [x] W3 (2026-09-30, 8cbb0199) Guide `docs/agent/routines.md` (the agent's CORPUS, not the dev doc): what a routine is, how to save one
  from a plain description (steps = generate args, in order), run, list, delete, the missing-model answer, the
  price ask; right/wrong pairs; <= 200 lines, no stories or prices. Adds `- app:routines: <title>` to the system
  prompt (~27 of 52 spare bytes). **Verify:** budget test green (SYSTEM_BUDGET unchanged).

## Phase 4: Agent suite (costs money: ask Fabio first)

- [x] B1 (2026-09-30, 8cbb0199: five cases incl. D12, all 3/3, flips bite, $0.0374) Four cases in `services/agentBench.mjs`: list; save from a plain description (steps in order, guide
  read first); "run X on these" = ONE `routine run` with the cards; delete. Every stored score then reads
  "(older tests)". **Verify:** one DeepSeek run (~$0.10, Fabio's yes first) passes the four; report the spend.

## Phase 5: Docs + Fabio's look (verify mode user-ux)

- [x] F1 (2026-09-30, 8cbb0199) Dev doc `docs/routines.md` (<= 200 lines: storage, schema, runner, relay, tool, gates), a row in
  `docs/README.md`, the `docs/agent-chat.md` tool table row, a cross-link from `docs/stacks.md`, a topic line in
  `.agents/mpi-kanban/project-knowledge-index.md`. **Verify:** every path named in the new doc exists.
- [ ] F2 Fabio, in his app: ask the agent to save a 3-step routine, list it, run it on 2 cards, look at the result
  stack and scroll a card's History, delete it. **Verify:** his yes.

## Phase 6: Routines on the gallery selection bar (D13, verify mode user-ux)

**D13 (Fabio, 2026-09-30, took every pick):** the user runs a saved routine from the gallery selection bar; only
the agent creates them (a create/delete UI is 2.1, not this card). Reverses D8's "agent-free entry point".
- A "Routines" dropdown right after Stack; absent when no routine is saved. Project + global in one list, the
  project's wins a name clash.
- A paid routine shows the whole run's price in the option (`×4 · $0.12`); the pick is the yes, as CUE's price tag.
- Greyed with a status-bar reason: needs a run input (D9) -> "ask the agent to run it"; a model/Flow missing ->
  named; wrong kind (starts on pictures, a video is selected).
- The result stack lands like any run; a status-bar notice only when a card failed or a step was skipped.
- Agent wording: "the app has no routine button" -> the user can also run one from Routines on the selection bar.

- [x] U1 (2026-09-30, 7026c025: 6 cases in routine-runner.test.cjs) `routineRunner.js` pure `routineChoice(routine, kinds, deps)` -> `{ ok, billed, usd }` | `{ ok: false, info }`
  (validate, inputs, kind, missing, price). **Verify:** cases in `tests/routine-runner.test.cjs`.
- [x] U2 (2026-09-30, 7026c025: live in an own isolated app, see validation.md) Wiring: `routineDispatch.js` `routineMenu` (options) + `runSavedRoutine` (the `routine.run` handler + one
  notice); selection bar dropdown; grid `setRoutineMenu(fn)` + `routine` event; the block reads both lists on
  `selection-start` (list gives a step COUNT, so each routine is read by name). **Verify:** `npm test`; live in an
  own isolated app: list, greyed reason, run on 2 cards -> one stack.
- [x] U3 (2026-09-30, 7026c025: system prompt 10,370 / 10,390) Wording: system-prompt Routines rule, tool description, `docs/agent/routines.md`, bench `routine-save`
  check; `docs/routines.md` + `docs/gallery-selection.md`. **Verify:** budget test green.
- [ ] U4 Fabio's look (with F2). Round 1 fixes (width, rename, delete) verified by him 2026-09-30; `move` added on
  his ask, his look at it pending.

## Plan Drift

- 2026-09-29 (c4eb2969): Phase 1 answered S2 the good way (closed projects work), so no `PROJECT_NOT_OPEN`
  refusal; Flows as a later step need a `flowService.js` passthrough (added to `files.json`), every Flow at
  any step. Details: `## Current State` § Phase 1 findings.
- 2026-09-30 (26163994): T1 integration fix - the worker let a step with NO required input (t2i) through at any
  position; D1 / `selectCueAllTargets` need exactly one, so it is now `NOT_BATCHABLE` (first or later step) and
  `inputKind` is never null. Save-time checks stop at named params, tool fields and Flow field ids: a Flow's box /
  frame `params` (outpaint's `params.frame.ratio`) are checked only at run, by the shared build half R1 reuses from
  `_submitFlow`. R1: T1 validates `denoise` on a model step, but `resolveSettingsOwner` never forwards it, so align
  the two when splitting build from enqueue.
- 2026-09-30 (26163994): Fabio asked for routines that take inputs besides the card (D9) -> T1 and the runner grow
  `inputs`; W2's tool gains an `inputs` param and W3's guide a section. Scene recipes explicitly deferred.
- 2026-09-30 (d46a8d69): the denoise drift noted above was a live agent bug, not only a routine one - fixed in
  `resolveSettingsOwner`. `lookups.flows` is the live `FLOWS` array; a tool step has no up-front install check (a
  missing upscaler/BiRefNet weight fails that card's step, ponytail in `routineDispatch.js`).
- 2026-09-30 (bd66b68e): W1 built with R2 (R2's verify needed a route). Route shape changed from the plan: a separate
  `/quote` route (the loop asks the price before it runs) instead of `run` relaying both; no DELETE route - a delete
  rides `POST /connector/routines { delete: true }` as a forgotten note does; the save check is RELAYED to the renderer
  (`routine.validate`) because the server's `FLOWS` import has no package Flows. W1's loopbacks deferred to W2, which
  owns their call shape. A closed project needed hydrating in `readProject` (R1 live ran only in an OPEN project).
- 2026-09-30 (8cbb0199): W2's tool takes run values as `values` (an object), not `inputs` (save's declarations, an
  array): one name with two shapes needs a type-less schema some providers reject. D12 lives in the tool description,
  not a system-prompt line: no capability summary exists to add it to, and SYSTEM_BUDGET had 23 bytes left after the
  guide's index line. generate's body mapping moved into `_generateFields` (shared with routine steps). F1 done in
  the same session (auto), ahead of B1 which waits on Fabio's yes.
- 2026-09-30 (8cbb0199, after B1): D12 in the tool description failed 0/3 live, so it moved to a system-prompt
  line after all and SYSTEM_BUDGET rose (+140); the Verification line "only TOOLS_BUDGET raised" no longer holds.

- 2026-09-30 (7026c025): D13 reverses D8's agent-free entry (run only). Fabio's U4 round 1 added a `rename` action
  to the tool: rename-as-save-then-delete (the old guide) made the agent retype steps from a step COUNT, and the
  "I never delete" limit stopped the delete half. SYSTEM_BUDGET 10,460 and TOOLS_BUDGET 18,240 raised for it.

## Verification

**Verify mode:** user-ux (Phase 5 F2 only; Phases 1-4 are auto).

Done when: a routine saved by the in-app agent from a plain description runs on N cards in ONE tool call, lands
as one new stack whose cards carry every step as History versions, refuses up front when a model or Flow is
missing, asks a paid price once, and can be listed and deleted; `npm test` green; the budget test green with
only `TOOLS_BUDGET` raised; the four suite cases pass; Fabio's look.

## Preservation Notes

- `docs/agent/` is the running agent's corpus; `docs/agent-*.md` is the developer contract. The guide goes in the
  first, the dev doc is `docs/routines.md`.
- Raising `TOOLS_BUDGET` is a decision in the diff: say why in the constant's comment.
- `routes/connector.js` and `services/agentLoop.mjs` are hot shared files: claim before editing, check peers.
- MCP exposure is a separate future card (D8); do not grow this one. The agent-free RUN entry is D13 (Phase 6);
  a create/delete UI is 2.1.

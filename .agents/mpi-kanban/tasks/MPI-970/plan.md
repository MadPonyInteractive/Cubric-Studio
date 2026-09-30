# MPI-970 Plan: Routines - the agent saves a chain once, the app runs it on any card in one call

## Current State

2026-09-29 (session c4eb2969, Agent 66) - card in `doing`, `files.json` written. **Phase 1 DONE: S1, S2, S3
all passed live** (below). **Next: Parallel Batch Foundations (T1, T2) via `mpi-execute-parallel`**, then R1 with
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

- [ ] T1 Pure routine model + validator. Ownership: `js/data/routineModel.js`, `tests/routine-model.test.cjs`.
  Briefings: `dos_and_donts`, `root-cause`. Schema `cubric/routine/v1` `{ schema, name, summary, steps[],
  created_at }`; `normalizeRoutine`, `validateRoutine(routine, lookups)` where `lookups` injects the model,
  Flow and tool catalogues (no renderer state), checking per step: modelId+operation XOR flowId XOR a tool op
  (`AGENT_TOOL_OPS`); named params via `resolveNamedParams(null, ...)`; tool fields via `toolRun`'s checks
  (extract a pure helper if they are tangled with dispatch); the media-kind chain (step N's output kind must be
  step N+1's one required media kind, `selectCueAllTargets`); D6 caps; no `media`/`cards`/`count` inside a step.
  Also `routineSummary(routine)` = the plain-words line `list` shows. **Verify:** `node --test
  tests/routine-model.test.cjs` covers a legal 3-step chain, each refusal code, and an image->video->image kind
  break.
- [ ] T2 Routine file store. Ownership: `services/agentRoutines.mjs`, `tests/agent-routines-store.test.cjs`.
  Briefings: `dos_and_donts`, `root-cause`. Modelled on `services/agentMemory.mjs`: `listRoutines(folderPath |
  global)`, `readRoutine`, `writeRoutine` (atomic write, slug `^[a-z0-9][a-z0-9-]{0,60}$`, overwrite = same
  name), `deleteRoutine` (D5 move); project dir `<project>/Agent/routines/` refuses a folder with no
  project.json (`NOT_A_PROJECT`); global dir beside the global notes; caps (D6). Takes an ALREADY-validated
  routine: validation is wired in Phase 4. **Verify:** `node --test tests/agent-routines-store.test.cjs` in a
  temp dir: write/list/read/overwrite/delete both scopes, the caps, a bad slug, a non-project folder.

Run this batch with `mpi-execute-parallel` (disjoint files, per-task verify, no intra-batch dependency).

## Phase 2: The runner (renderer)

- [ ] R1 `js/services/routineRunner.js`: `quoteRoutine(routine, cards)` -> `{ missing[], usd, display }`
  (installed checks per step: model installed / cloud key / `flowAvailability`; price = sum of
  `estimateRunCost` x cards); `runRoutine(routine, cards, { projectFolder })` -> starts, returns `{ runId }`,
  per card runs the steps in order awaiting each job's `onComplete`, step 1 new card (into the result stack when
  N > 1), later steps `{ existingGroup }`; D3 failure/cancel handling; emits one completion with
  `{ ok, cards: [{ groupId, steps, failedAt?, error? }], stackId }`. Re-validates with T1 before running (a model
  update can make a saved setting illegal). Phase 1's findings decide the exact opts. **Verify:** unit test with a
  stubbed `enqueueGeneration` (order, versioning opts, stack membership, a mid-chain failure, a cancel) +
  one live 2-card x 3-step run in an own isolated app.
- [ ] R2 Relay capabilities in the renderer: `routine.quote` and `routine.run` beside `generation.submit`
  (`js/shell/agentDispatch.js` or a new `js/shell/routineDispatch.js` if agentDispatch is claimed); the run's
  completion posts back like a slow generate (`POST /connector/jobs/:id/result`). **Verify:** a connector call
  from a scratch script to the own isolated app runs a saved routine and gets the result back.

## Phase 3: Agent wiring (server)

- [ ] W1 Routes in `routes/connector.js`: `GET /connector/routines[?scope=global]`, `GET /connector/routines/:name`,
  `POST /connector/routines` (validate with T1, store with T2), `DELETE /connector/routines/:name`,
  `POST /connector/routines/:name/run` (relays `routine.quote`, then `routine.run`). Loopbacks in
  `services/agentTools.mjs`. **Verify:** route tests beside the existing connector tests.
- [ ] W2 `routine` tool in `TOOL_DEFS` (`services/agentLoop.mjs`): `{ action: list|save|run|delete, name,
  scope, summary, steps, cards }`; description SHORT and plain (Fabio), target ~350 bytes including D7's clause;
  `save` refused with `KNOWLEDGE_NOT_READ` until `app:routines` is read (`_readIds` / `_gateWaiting`); `run`
  answers the missing list as a refusal naming each model/Flow, asks `_askSpend` ONCE when the quote has a price,
  then returns running and posts a `[Routine finished]` note on completion (like `[Batch finished]`). Raise
  `TOOLS_BUDGET` by the measured amount only, with the reason in the constant's comment. **Verify:**
  `node --test tests/agent-prompt-budget.test.cjs` + a loop unit test for the gate, the missing refusal, the one
  spend ask.
- [ ] W3 Guide `docs/agent/routines.md` (the agent's CORPUS, not the dev doc): what a routine is, how to save one
  from a plain description (steps = generate args, in order), run, list, delete, the missing-model answer, the
  price ask; right/wrong pairs; <= 200 lines, no stories or prices. Adds `- app:routines: <title>` to the system
  prompt (~27 of 52 spare bytes). **Verify:** budget test green (SYSTEM_BUDGET unchanged).

## Phase 4: Agent suite (costs money: ask Fabio first)

- [ ] B1 Four cases in `services/agentBench.mjs`: list; save from a plain description (steps in order, guide
  read first); "run X on these" = ONE `routine run` with the cards; delete. Every stored score then reads
  "(older tests)". **Verify:** one DeepSeek run (~$0.10, Fabio's yes first) passes the four; report the spend.

## Phase 5: Docs + Fabio's look (verify mode user-ux)

- [ ] F1 Dev doc `docs/routines.md` (<= 200 lines: storage, schema, runner, relay, tool, gates), a row in
  `docs/README.md`, the `docs/agent-chat.md` tool table row, a cross-link from `docs/stacks.md`, a topic line in
  `.agents/mpi-kanban/project-knowledge-index.md`. **Verify:** every path named in the new doc exists.
- [ ] F2 Fabio, in his app: ask the agent to save a 3-step routine, list it, run it on 2 cards, look at the result
  stack and scroll a card's History, delete it. **Verify:** his yes.

## Plan Drift

- 2026-09-29 (c4eb2969): Phase 1 answered S2 the good way (closed projects work), so no `PROJECT_NOT_OPEN`
  refusal; Flows as a later step need a `flowService.js` passthrough (added to `files.json`), every Flow at
  any step. Details: `## Current State` § Phase 1 findings.

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
- MCP exposure and the agent-free overlay are separate future cards (D8); do not grow this one.

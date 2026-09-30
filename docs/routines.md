# Routines (MPI-970)

A routine is a chain of steps saved once under a name; the app runs the whole chain on any cards
in ONE call. Each input card runs the chain on its own: step 1 makes a NEW card (the input card is
never versioned), every later step lands as that card's next History version, and N cards finish
as ONE new stack (one card in -> one new card, no stack). The in-app agent reaches it through one
`routine` tool; the RENDERER runs it, because generation, stacks, History versions, the installed
checks and the price are all renderer-owned.

Decisions D1-D13 and why: `.agents/mpi-kanban/tasks/MPI-970/plan.md` (§ Decisions) and
`brief.md`. The agent's own guide (what the running agent reads) is `docs/agent/routines.md`, not
this file.

## The pieces

| Layer | File | Owns |
|---|---|---|
| Schema + validator | `js/data/routineModel.js` | `normalizeRoutine`, `validateRoutine(routine, { models, flows })`, `routineSummary`, `ROUTINE_PLACEHOLDER`. Pure: imports in plain Node |
| Store | `services/agentRoutines.mjs` | the files (one set for every project, in app data), caps, delete-as-move, rename-in-place; throws `RoutineError{code}` |
| Runner | `js/services/routineRunner.js` | `quoteRoutine`, `runRoutine`, `routineChoice` (the gallery menu's yes/why-not): order, landing, skip and failure rules. Pure: every app touch is `deps` |
| Renderer deps + relay | `js/shell/routineDispatch.js` | `routineDeps` (check, price, readProject, submit, addStack), `ROUTINE_HANDLERS`, and the gallery menu's `readSavedRoutines` / `routineMenu` / `runSavedRoutine` |
| Gallery menu (D13) | `MpiGalleryGrid/selectionBar.js`, `MpiGalleryGrid.js`, `MpiGalleryBlock.js` | the Routines dropdown on the selection bar |
| Routes | `routes/connector.js` § routines | `/connector/routines*`: store, relay the check / quote / run |
| Agent tool | `services/agentLoop.mjs` `_routine` + `services/agentTools.mjs` loopbacks | the gates: guide, quote, one spend card, held run, one note |

## Storage and schema

`cubric/routine/v1` `{ schema, name, summary, inputs[], steps[], created_at }`, one JSON file per
routine in `<APP_USER_DATA>/agent/routines/<name>.json`: ONE set for every project. Projects are
thrown away, routines are kept (Fabio, 2026-09-30; a project scope and a `move` between the two were
built and removed that day). A run still lands in the project it names.
Name slug `^[a-z0-9][a-z0-9-]{0,60}$`; saving an existing name replaces it. Caps (D6): 50 routines
(`ROUTINES_FULL`), 10 steps (`TOO_MANY_STEPS`). Delete MOVES the file to `routines/deleted/` (D5),
as a forgotten note moves; a second delete of one name keeps both copies (the older gets a
`-<ms>` suffix).

A step is exactly one of: a model op `{ modelId, operation, positive?, negative?, ratio?, ... }`,
a Flow `{ flowId, fields?, params? }`, or a tool `{ operation, fields }` (`AGENT_TOOL_OPS`:
`imageUpscale`, `removeBackground`, `crop`, `downscale`). The step's words are the CONNECTOR's
(`positive`, a tool's settings in `fields`), not the generate tool's.

Save-time checks (`validateRoutine`): step shape, the model has the op, named params through
`resolveNamedParams(null, ...)`, tool fields through `toolRun`, Flow field ids; every step takes
EXACTLY one required picture/video/sound (`NOT_BATCHABLE` otherwise, so no t2i and no two-input
op); kinds chain step to step (`MEDIA_KIND_BREAK`). It returns `inputKind` (what step 1 takes) and
`outputKind` (the last step's: the stack's kind). A Flow's box/frame `params` are checked only at
run, by the shared build half.

### Run inputs (D9)

`inputs: [{ id, kind: image|video|audio|text, label? }]`, fixed for the whole run. A media input
fills a REFERENCE slot as `media: [{ role, input: <id> }]` (never the required slot: that is the
card or the previous result; a `url`/`path` is `STEP_HAS_MEDIA`). A text input is `{id}` in
`positive`/`negative`/a Flow field. Undeclared, unused, wrong-kind: `INVALID_INPUT`. At run a media
value is a card id of this project (its selected version) or a file; left out = `INPUT_MISSING`
(`missing: [ids]`), refused before anything queues, and at quote time too.

## The run (renderer)

`runRoutine(routine, cardIds, { projectFolder, inputs }, deps)`, shaped by the Phase 1 spike:

1. Re-validate (a model update can make a saved setting illegal); every model/Flow checked
   installed (`NOT_INSTALLED` + `missing`, by name); every card checked before anything runs
   (`CARD_NOT_FOUND`, `WRONG_MEDIA_TYPE`).
2. Queue every card's FIRST step, then add the result stack (`expected` = cards queued). Jobs first,
   because the settle drops a filling stack with no live job. `stackId` (+ `batchId`/`batchLabel`/
   `batchTotal`) rides on EVERY step so the stack reads "filling" until the last step of the last
   card, then settles itself.
3. Per card, sequentially: re-read the project before each later step (a closed project's step-1
   snapshot has no result card), submit with `existingGroup` = the result card.

Rules: a failed or cancelled step stops THAT card (D3), its card keeps the versions made, the others
carry on. A step with nothing to do (`ALREADY_SMALLER`, `_nothingToDo`) is SKIPPED for that card
(D10): step 1 skipped means the next step makes the new card. An image->video routine lands the clip
as a video version in the image card, and the stack kind follows the last step (D11). Sound results
stay loose (no stack). `finished` resolves `{ ok, runId, stackId, cards: [{ inputGroupId, groupId,
steps, skipped?, failedAt?, error? }] }`.

`quoteRoutine(routine, n, deps, inputs)` -> `{ missing[], billed, usd|null }`, dispatching nothing;
`usd` null when a billed step cannot be priced (still asked about).

### The renderer deps (`routineDispatch.js`)

Each step builds through the SAME halves the agent's submit uses (`buildGeneration` / `buildTool` /
`buildFlow`, `agentDispatch.js`), then enqueues with explicit opts: step 1 `scope: 'gallery'` with a
placeholder, later steps `scope: 'groupHistory'` on the result card; a Flow gets the same through
`submitFlowGeneration`'s run-only `runLanding`. A routine drops the settings pin, the painted mask
and follow-the-view on purpose. `readProject` hydrates a CLOSED project (`reconcileAndHydrate`: raw
`/get-project` history is item ids). `addStack` uses `addGroup` when open, `/project-groups` when
closed. A tool step has no up-front install check (a missing weight fails that card's step).

## Relay and routes

`ROUTINE_HANDLERS` (`routine.validate`, `routine.quote`, `routine.run`) are registered in
`agentDispatch.js` `_HANDLERS` and looked up at call time (import cycle). Input `{ routine, cards,
inputs?, folderPath? }`; a stack id in `cards` expands to its members (`expandStacks`).

| Route | Does |
|---|---|
| `GET /connector/routines` | the list: `{ name, summary, steps: <count>, inputs }` |
| `GET /connector/routines/:name` | one routine whole |
| `POST /connector/routines { routine }` | relays `routine.validate` (only the renderer's `FLOWS` holds package Flows), stores what the check returns; answers `{ name, created, summary }` |
| `POST /connector/routines { name, delete: true }` | the delete (no DELETE route, as memory's forget) |
| `POST /connector/routines { name, rename }` | renames in place: `{ name: rename, renamed }`, `NAME_TAKEN` rather than overwrite |
| `POST /connector/routines/:name/quote` | `{ missing, billed, count, usd, display }` |
| `POST /connector/routines/:name/run` | HELD until every card's chain has ended (no clock): the `finished` summary |

A quote or run lands in `folderPath`, or the open project without one. Tests: `tests/connector-routines.test.cjs`.

## The agent tool

`routine { action: list|save|run|rename|delete, name, newName, summary, steps, inputs, cards, values }`
(`services/agentLoop.mjs` `_routine`; loopbacks `listRoutines`, `saveRoutine`, `deleteRoutine`,
`quoteRoutine`, `runRoutine` in `services/agentTools.mjs`, allowlisted in
`tests/agent-no-delete.test.cjs`). Its description carries D7 (offer to save repeated steps). D12
(routines are in the answer to "what can you do") is the system prompt's Routines rule: said only in
the tool description, DeepSeek left routines out 0/3 in the B1 suite.

- **list** answers `{ routines }`. list, save, rename and delete need no open project; only a run does (`NO_PROJECT`).
- **rename** (`newName`) moves the file and its `name` (store `renameRoutine`). Save-new-then-delete made the agent
  retype every step from `list`'s step COUNT, and Fabio's agent, reading "I never delete" as covering routines, left
  the old copy (F2). The system prompt's limits line now names routines as the one thing it deletes.
- **save** is refused `KNOWLEDGE_NOT_READ` until `app:routines` is read (`_gateWaiting`, so the read
  answers "the call that waited has NOT run"). Each step goes through `_generateFields`, the SAME
  mapping `generate` builds its body with: `prompt` -> `positive`, a tool's own field names into
  `fields`. Without it a saved prompt was an unknown key, silently dropped. A step read back off a
  list (`positive`) saves the same.
- **run**: `cards` are groupIds; a dragged card's ref or a `set:` ref maps to groupIds through the
  `groupId` kept on those `_images` entries. A `values` ref resolves like `generate` media (an
  attachment is placed into the project first). Then quote -> `NOT_INSTALLED` refusal by name, no card -> ONE spend card for every
  billed step of every card (`_confirmSpend`, the card `_askSpend` raises) -> the held run with the
  1 s refusal race -> `started`. The finish pushes ONE `[Routine finished]` note (`_routineNote`:
  new cards, the stack, per step which cards skipped or failed, grouped, 5 names a group) and joins
  the drain: `_routineRuns` holds `agent:drained` until it ends, so the wake reports it.

Known ceilings (ponytail, in the code): a routine run is not in `_inflight`, so `cancel_generation`
cannot reach it (the user's Stop can); every routine counts as a local GPU job when the engine is
local, so an all-cloud routine still makes a local agent wait; the spend card says "for N
generations" with N = cards, though the price covers every billed step.

## The gallery's Routines menu (D13)

The user runs a saved routine without the agent: a **Routines** dropdown beside Stack on the
selection bar ([gallery-selection.md](gallery-selection.md)). Only the agent creates or deletes
routines (a UI for that is 2.1). The block reads the routines on every `selection-start`
(`readSavedRoutines`: the list route gives a step COUNT, so each routine is read by name) and hands the grid `setRoutineMenu(groups => options)`;
none saved = no dropdown. Each option comes from `routineChoice` on the selection's kinds (a stack
counted as its cards): the summary in the status bar and a paid run's whole price as the meta
(`×4 · $0.12`, the pick is the yes, as CUE's price tag), or greyed with the reason: needs a run
input (the menu fills none: ask the agent), a model or Flow not installed, the wrong kind. A pick
emits `routine { name, groups }`; `runSavedRoutine` calls the SAME `routine.run` handler the relay
does, and the only word back is a status-bar notice when it refused, a card failed, or a step was
skipped.

## Not in this card (D8)

MCP exposure for outside agents, a UI to create or delete routines (2.1), scene recipes (steps from
nothing, several earlier results by name), two varying sets in one run, saved default input values.

## Tests

`tests/routine-model.test.cjs`, `tests/agent-routines-store.test.cjs`,
`tests/routine-runner.test.cjs`, `tests/connector-routines.test.cjs`,
`tests/agent-routine-tool.test.cjs` (the loop's gates), `tests/agent-prompt-budget.test.cjs`
(`TOOLS_BUDGET` raised for the tool), `tests/history-completion-live-card.test.cjs` (the
second-History-job fix the runner needed).

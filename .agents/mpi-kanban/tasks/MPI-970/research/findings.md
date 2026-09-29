# MPI-970 research (session 726c00ac, 2026-09-29)

Three read-only Haiku investigators; every fact the plan leans on was re-checked by hand. Two of their claims
were WRONG and are corrected here: read this file, not their transcripts.

## Agent tool surface
- Tools: `TOOL_DEFS` in `services/agentLoop.mjs` (~47-421), OpenAI shape `{ type:'function', function:{ name,
  description, parameters } }`; dispatch in `_executeTool`. Template: `read_memory`/`write_memory` ->
  `services/agentTools.mjs` (node:http loopback, not fetch) -> `routes/connector.js` `/connector/memory*` ->
  `services/agentMemory.mjs`.
- Memory storage (the routine-store template): project `<project>/Agent/<slug>.md` + `README.md` index
  (`notesDir(folderPath)` refuses a folder with no project.json -> `NOT_A_PROJECT`); global
  `<APP_USER_DATA>/agent/memory/` (`globalDir()`); `scope=global` in query or body; caps MAX_NOTES 50
  (`MEMORY_FULL`), 4 KB (`NOTE_TOO_LONG`); forget moves to `Agent/forgotten/`.
- Guide gate: `_readIds` (Set of knowledge ids read), `_gateWaiting`; `GUIDE_NOT_READ` for model guides,
  `KNOWLEDGE_NOT_READ` for `app:*` (e.g. `app:masking` on a masked op). A `routine save` gate on `app:routines`
  plugs into the same pair.
- **Every `docs/agent/*.md` is auto-registered** (`services/agentCorpus.mjs` `appEntries()`) AND listed in the
  system prompt (`agentLoop.mjs:1626`: `- ${e.id}: ${e.title}`). A `routines.md` guide costs ~27 bytes of
  system prompt. `docs/agent/routines.md` does NOT exist yet (an investigator claimed it did).
- Budgets (`tests/agent-prompt-budget.test.cjs`): SYSTEM_BUDGET 10,150 (measured 10,098 -> 52 spare);
  TOOLS_BUDGET 17,300 (measured 17,249 -> 51 spare). Agent docs <= 200 lines, no stories or prices.
- Agent suite: `services/agentBench.mjs`, 26 cases `{ id, title, setup:{turns,...}, flip, check(run) }`;
  `suiteHash(cases)` changes with any case text -> every stored score reads "(older tests)".
- MCP (`routes/mcp.js`): 17 tools, HAND-WRITTEN; a new in-app tool does not appear there.

## Runner, stacks, History versions
- Stack run (renderer): `MpiGalleryBlock._runStack()` enqueues one job per member with `stackId`; results join
  via `projectService.addGroupsToStack()`; `settleResultStack` settles `expected` on queue drain
  (`generationService._settleResultStacks`). `docs/stacks.md`.
- Agent batch (MPI-941): `agentLoop._fanOut()` fires every item with NO await, one `_newBatch()`
  (start/settle/close, `[Batch finished]` note). Nothing chains item N+1 on item N's output today.
- **Versioning an existing card:** `enqueueGeneration(config, { existingGroup })` appends each output with
  `appendToHistory` (`generationService.js:1657-1690`), re-reading the group from `_originProject` (a card
  deleted meanwhile -> the job is dropped). `workspaceGenerationOpts(mediaItems, type)`
  (`js/shell/agentDispatch.js:429`) picks the OPEN card if it owns the input file, else ANY card of that type
  in `state.currentProject` that owns it. So a step whose input is the previous step's output lands as the next
  version of that same card, whether or not the card is on screen. If the project closed mid-job the append
  still lands server-side (`_addGroupsToClosedProject`, MPI-839). **Unproven:** a routine started in a project
  that is NOT open (the lookup only searches `state.currentProject`).
- Lanes: `generationService._lanes` remote/local/cloud, one active job each, strictly serial within a lane.
- Results: `agent:result` `{ ok, output:{ itemId, groupId, type, filePath } }`; slow jobs answer
  `{ running:true, jobId }` and settle via `POST /connector/jobs/:id/result`.

## Validation, installed, spend
- `/connector/generate` checks (`routes/connector.js` ~523-672): flowId XOR modelId+operation; a tool op must be
  in `AGENT_TOOL_OPS` (imported server-side from `js/shell/agentToolOps.js:39`, so js/shell + js/data modules
  are importable by the route); named params via the PURE `resolveNamedParams(project, model, op, named)`
  (`js/data/generationControls.js` ~406, `project` null = static); seed; media via `_firstFrames()`.
  No dry-run mode exists.
- Tool field checks: `toolRun(op, fields, natural)` in `js/shell/agentToolOps.js` (~105-148).
- Media-kind eligibility for one-input ops: `selectCueAllTargets(op, model, groups)`
  (`js/data/commandRegistry.js:1865`) - the stack-run rule (exactly ONE required media slot of that kind).
- Installed: models `MODELS[].installed` via `syncModelInstalled()` (renderer, `js/data/modelRegistry.js`);
  cloud = key saved (`hasCloudKey`); Flows `flowAvailability(flowOrId)` -> `{available, missing, missingDeps,
  reason}` (`js/data/flowsRegistry.js` ~2836, renderer: reads `state.s_installedModelIds` + a dep cache).
- **Spend gate EXISTS** (an investigator said it did not): in-app `agentLoop._askSpend(turnId, body, count)`
  (`:1457`), a batch asks ONCE for the count (`:1245`, `_batchQuoteBody`); outside agents get `CONFIRM_COST`
  (`routes/mcp.js:153`). Price: `estimateRunCost(model, params, media)` (`js/services/cloudExecutor.js` ~161);
  `/connector/quote` prices without dispatching.
- No saved-preset feature to clash with: prompt Reuse is a per-card snapshot (`js/utils/promptReuse.js`).

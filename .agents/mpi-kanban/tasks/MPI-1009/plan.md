# MPI-1009 Routines over MCP

Outside agents (Claude, Codex, Antigravity) list, read, save, rename, delete and run the app's
saved routines through the MCP server, with the same money and long-run rules `generate` has.

## Current State

Project mode: scalable-foundation. Read 2026-10-01 (Agent 82):

- The HTTP half exists and is unclaimed by this card: `routes/connector.js:1148-1192`
  (`GET/POST /connector/routines`, `GET /connector/routines/:name`, `POST .../:name/quote` and
  `/run`; a run is HELD until every card's chain ends). Client calls already exist in
  `services/agentTools.mjs:299-333` (`listRoutines`, `saveRoutine`, `deleteRoutine`,
  `renameRoutine`, `quoteRoutine`, `runRoutine`; `_post` is `node:http` with no clock, so a
  long run is not cut at 300 s). There is no `readRoutine` client.
- `routes/mcp.js` has 17 tools, no routine tool, and `INSTRUCTIONS` never says routines exist.
- The renderer half takes `folderPath` open OR closed (`js/shell/routineDispatch.js`
  `_runTarget` -> `agentDispatch.targetProject`, compared case- and slash-insensitively), and a
  stack's groupId stands for its cards.
- Cosmo's tool (`services/agentLoop.mjs:1577-1659`) quotes first (missing -> NOT_INSTALLED),
  asks the price once, then holds the run and reports one note. Its saves go through
  `_generateFields`, which maps `prompt` -> `positive` and moves a tool's own settings into
  `fields`.
- **Silent-drop hole found while planning:** `validateRoutine` (`js/data/routineModel.js:243+`)
  ignores a `prompt` key and ignores a tool step's top-level `ratio` / `factor` / `megapixels`
  (it reads only `step.fields`). Cosmo never hits it; an MCP agent following
  `app:routines` (which writes `prompt:` and `{ operation: "crop", ratio: "1:1" }`) would save a
  routine that runs with no prompt or the default crop. `/connector/generate` refuses the same
  keys outright.
- Peer: MPI-1004's live claim covers `routes/connector.js`, `services/agentLoop.mjs` and
  `docs/agent-chat.md`. This plan touches none of them.

## Decisions

- **D1 Five narrow tools, not one `routine` action tool**: `list_routines`, `save_routine`,
  `rename_routine`, `delete_routine`, `run_routine` (17 -> 22). MCP annotations are per tool:
  one tool that can delete must carry `destructiveHint: true`, and clients would then prompt
  on every list. Narrow verbs are also this server's style (`list_cards`, `rename_card`).
- **D2 `list_routines` with an optional `name`** answers that one routine in full (its steps),
  via a new `agentTools.readRoutine` -> `GET /connector/routines/:name`. Without it an outside
  agent cannot change one step of a routine without rebuilding it blind. The no-delete
  allowlist gains that GET.
- **D3 Money = `generate`'s gate.** `run_routine` quotes first. `missing` -> NOT_INSTALLED,
  nothing runs. `billed` -> CONFIRM_COST naming the quote's `display` (the whole run: every
  paid step on every card) and runs nothing until resent with `confirmCost` equal to it.
  `spendGate` is generalised to take the quote, not copied.
- **D4 Long run = a Flow's answer.** The run starts under `startJob`; a refusal inside 3 s
  comes back as is, otherwise `{ running: true, jobId }`, finished by `wait_generation`. The
  finished answer is the route's `{ runId, stackId, cards }`; the description says
  `list_cards` with the stackId (or a card's groupId) gives the paths. The running message
  names `run_routine`, not `generate`, as the thing never to resend.
- **D5 No cancel for a routine job.** The runner submits steps without a `requestId`, so
  `/connector/cancel` cannot name them (Cosmo cannot cancel a routine either).
  `cancel_generation` and a chat Stop on a routine job answer plainly that it cannot be stopped
  from here and the user stops its renders in the app's queue (a stopped card ends at that
  step); they never call `/connector/cancel` and report a misleading NOT_IN_FLIGHT.
- **D6 Project, cards, values.** `openFolder` resolves `folderPath` (named, open or not) or the
  open project, and the resolved folder is sent to BOTH quote and run, so a project switch
  between them cannot move the run. `cards` = groupIds from `list_cards` (a stack's groupId =
  its cards). `values` = `{ inputId: value }` (Cosmo's word): a value that is a media file on
  disk is staged into that project the way `generate` stages `media` (`stageMedia`); anything
  else (a groupId, words for a text input) passes as given.
- **D7 Save = generate's words; the validator refuses the silent drops (root cause).**
  `save_routine` steps are `generate` args exactly as the MCP `generate` takes them
  (`positive`, a tool's or Flow's settings in `fields`, `media` only `[{ role, input }]`).
  `validateRoutine` refuses a `prompt` key on a step ("use positive") and a tool step's
  top-level key that is one of that tool's own fields ("goes in fields"), as
  `/connector/generate` refuses them. Cosmo is untouched (`_generateFields` already
  normalises). Routines are unreleased (UNRELEASED.md), so no user's saved file can trip it.
  The tool description says to read `read_knowledge "app:routines"` before the first save and
  names the two differences from that Cosmo-voiced guide (write `positive`; a paid run answers
  CONFIRM_COST, not a Yes card). `docs/agent/routines.md` is NOT edited: Cosmo's generate
  takes `prompt`.
- **D8 `delete_routine`** carries `destructiveHint: true` (a soft delete to
  `routines/deleted/`, recoverable, but the client should ask). Description: only when the
  user asks. `tests/mcp.test.cjs`'s "deletes nothing" assertion names it as the one exception;
  `docs/mcp-server.md`'s "None deletes" line says so.
- **D9 Knowledge:** one `INSTRUCTIONS` line (routines exist; list_routines; run_routine follows
  generate's money and running rules). The public plugin's `SKILL.md` and the `.mcpb`
  manifest's declared tool list are NOT changed here: the bridge passes the live `tools/list`
  through, so clients see the new tools without a new bundle; refreshing the manifest is a
  public release (Your call).

## Implementation

- [ ] Implement the planned change end to end. **Verify:** `node --test tests/mcp.test.cjs tests/routine-model.test.cjs tests/agent-no-delete.test.cjs tests/connector-routines.test.cjs tests/agent-routine-tool.test.cjs` green, `npm run lint` clean on touched files, then the live check in `## Verification`.

Files (all unclaimed at planning time):

- `routes/mcp.js` - the five tools (D1-D8), `spendGate` generalised, a routine flag on the job
  for D4/D5, the INSTRUCTIONS line, header count 17 -> 22.
- `services/agentTools.mjs` - `readRoutine(name)` (D2).
- `js/data/routineModel.js` - the two refusals (D7).
- `tests/mcp.test.cjs` - fake routine routes; list + read by name; save passes steps through;
  run free -> running then `wait_generation` delivers with ONE run call; run paid ->
  CONFIRM_COST and no run call, then confirmCost -> runs; missing -> NOT_INSTALLED, no run
  call; a disk-path value is staged and a groupId value passes; folderPath reaches quote AND
  run; cancel on a routine job answers the refusal and never hits `/connector/cancel`;
  `tools/list` is 22 with `delete_routine` the only destructive one.
- `tests/routine-model.test.cjs` - `prompt` on a model step and `ratio` at a crop step's top
  level are refused; the same in `fields` / as `positive` still passes.
- `tests/agent-no-delete.test.cjs` - `GET /connector/routines/:id` on the allowlist.
- `docs/mcp-server.md` - "The 22 tools", a Routines bullet (D3-D6), the delete exception.
- `docs/releases/UNRELEASED.md` - the routines bullet gains "outside agents too".

## Completed

- [x] Implemented end to end, 2026-10-01 (Agent 82): five tools + `askPrice` + routine job flag
  + INSTRUCTIONS line in `routes/mcp.js`; `readRoutine` in `agentTools.mjs`; the two refusals in
  `routineModel.js`; tests; `docs/mcp-server.md`; UNRELEASED line. 107 tests green, eslint clean,
  live run on an isolated instance (evidence in `validation.md`).

## Remaining Work

- Close-out only: commit by pathspec, CI green, close the card (`mpi-end-session`).

## Current State (after build)

Built, self-verified and committed at the handoff (Agent 82); card in doing/validating. Left:
CI green on that commit, then close the card (`mpi-end-session`). Nothing pending in code.
Fabio 2026-10-01: the `.mcpb` manifest tool-list refresh waits for the release (more tools are
coming while the agent is tested); it is now a precondition in `.claude/skills/mpi-release/SKILL.md`.

## Plan Drift

- 2026-10-01: `run_routine` stages a disk-path value with the CALLER's `folderPath`, not the
  resolved folder: `stageMedia` re-resolves it and checks `project.json`, as `generate` does.
- 2026-10-01: CONFIRM_COST was not live-checked (the isolated profile has no cloud key and
  Fabio's app is off limits); the unit test covers it through the shared `askPrice`.

## Verification

**Verify mode:** auto

1. The `node --test` line above, green.
2. Live, against an ISOLATED app (`npm run app:isolated`, its own port; never Fabio's :3000).
   Check the shared ComfyUI queue on 48188 is empty first. Over that instance's `/mcp`:
   `save_routine` a FREE tool-only routine (e.g. crop 1:1 then downscale), `list_routines`
   (and by name), `run_routine` on one card -> `running` -> `wait_generation` until done; the
   proof is the new card's file on disk and exactly one new card, never the tool's answer.
   `rename_routine`, then `delete_routine` (file lands in `routines/deleted/`).
3. Paid path: `run_routine` on a routine with a DeepInfra step ONLY to see CONFIRM_COST and
   the price; never resend with confirmCost. No paid run without Fabio's yes, price and run
   count first.

## Preservation Notes

- `docs/mcp-server.md` is the durable home (tool list, waits, spend gate, cancel). No
  `.claude/rules/` change expected (no component wiring).
- Global memory `tools/agent-clients-mcp-plugins.md`: only if the live check finds a client
  behaving differently with five more tools.
- Your call at close-out: refresh the `.mcpb` manifest tool list + a new bundle release and
  Registry publish (public). My pick: fold into the 2.0 release batch.

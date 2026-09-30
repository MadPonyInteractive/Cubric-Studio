# MPI-950 Plan - Agents see stacks as stacks

Last member of umbrella MPI-889. Fabio 2026-09-30: go, "your picks" (no stack/unstack tool for
the agent; several cards in -> one new stack out, like routines).

## Current State

2026-09-30 (Agent 76): ALL FOUR PHASES BUILT; `npm test` + lint green (validation.md). Next: commit,
CI green, then done + close umbrella MPI-889. Durable notes: `docs/stacks.md` § Agents (MPI-950).

Before: `services/agentCards.mjs` listed a stack as an
empty `kind: 'stack'`, `versions: 0` row with no ref, AND every hidden member as a loose card, so
neither the in-app agent nor an MCP client can tell what a stack holds. With a stack open in
History the App state line says nothing (the stack has no history, so no `activeEntry`).

Facts found while planning (verify a symbol still exists before relying on it):
- An agent edit of a card already lands as THAT card's next version (`agentDispatch.workspaceGenerationOpts`,
  MPI-891 D4: the card that owns the source, same media type). So a fan-out over a stack's members
  edits them inside the stack; only NEW cards (image -> video, a closed project) need a result stack.
- `enqueueGeneration` already takes `opts.stackId` (gallery scope): the result joins that stack
  (`addGroupsToStack`), and `_settleResultStacks` clears `expected` once no job of it is live.
- Routines already expand a stack id into its members (`routineDispatch._runTarget`) and return
  N cards as one new stack. The agent's dropped selection is a `set:<id>` ref (`this._sets`, MPI-948)
  that `_fanOut` expands.
- `routes/agent.js _sanitiseWorkspace` passes `card` through whole, so `card.stack` needs no route change.

## Remaining Work

### Phase 1: Read - stacks in card lists (auto)
- `services/agentCards.mjs`: a stack is ONE row (`kind` = the stack's kind, `stack: <count>`,
  `ref: 'set:<stackId>'`); its members are not listed loose (the gallery hides them too) and not in
  `total`. `readCard(stackId)` returns the stack plus `members` (slim rows, stack order, capped at
  MAX_LIMIT with `membersTotal`). A hidden `sets` map (stackId -> member refs) rides beside `files`.
- `services/agentLoop.mjs _seeCards`: register each stack's set (`this._sets`) and its members' files,
  so `generate cards: ["set:<id>"]` runs over the whole stack. list_cards description: one clause.
- `routes/mcp.js list_cards`: members mapped `withPath`; description names the stack row.
- **Verify:** `tests/agent-cards.test.cjs` (stack row, hidden members, readCard members),
  a loop test that a listed stack's `set:` ref expands, `tests/agent-prompt-budget.test.cjs`.

### Phase 2: An open stack in the App state line (auto)
- `js/shell/activeStackMember.js` (new, `activeFrame.js` shape): the Stack History workspace
  publishes the member on screen.
- `js/services/agentService.js _workspaceForTurn`: on a stack, `activeEntry` = that member's
  selected version; `card` = the member, plus `stack: { groupId, name, count }`.
- `MpiGroupHistoryBlock.js`: set/clear the reader.
- `services/agentLoop.mjs _appStateLine`: one clause naming the stack and its `set:` ref.
- **Verify:** unit test on `_appStateLine` with a stack workspace; `npm test`.

### Phase 3: Results - a fan-out of new cards lands as one new stack (auto)
- `services/agentLoop.mjs _fanOut`: cards > 1 -> `resultStack { id, name, total }` on every item's body.
- `routes/connector.js /connector/generate`: pass `resultStack` through.
- `js/shell/agentDispatch.js`: a gallery-scope job (not a version) of image/video output gets
  `stackId`; the stack is added (`resultStackFields`, `expected: total`) AFTER the first job is
  enqueued (the settle drops a filling stack with no live job). The result output names `stackId`.
- Batch note names the stack; `_groups` gets its id.
- **Verify:** agentDispatch unit test (stackId on a new-card job, none on a version job, stack
  added once); agent-loop fan-out test; `npm test`, lint.

### Phase 4: Docs, close-out (auto)
- `docs/stacks.md` (drop the MPI-950 TODO line), `docs/agent-chat.md`, `docs/mcp-server.md`.

## Verification

**Verify mode:** auto

`npm test` + lint green; CI green on the code commit. Fabio can eye it live after close
(list a project with a stack; "turn this stack into clips").

## Plan Drift

- 2026-09-30: the renderer names the result stack (`getCommand(op).label`), so `resultStack` is
  `{ id, total }` only. The stack decision is the exported pure `agentResultStack` (testable).
- 2026-09-30: `files` entries now carry `groupId`, so a routine given a listed ref (or a stack's
  set) names the card, not the file. New test file `tests/agent-stacks.test.cjs` replaced the
  planned `agent-dispatch.test.cjs`.

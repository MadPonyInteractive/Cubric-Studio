# MPI-941 plan - in-app agent umbrella 2

**Order, Fabio 2026-09-26: this card STARTS AFTER MPI-817 CLOSES.** He wants the old agent
umbrella finished first, then this one, passed from session to session by handoff. Do not
move this card to `doing` while MPI-817 is still open.

## Members

| Phase | Card | Title |
|---|---|---|
| 1 | none (Fabio, 2026-09-26) | A big batch is ONE job to the agent: one progress line, one report, no looks |
| 2 | none (orphan) | `look` sees videos and GIFs |
| 3 | MPI-904 | Agent image tools: plain enlarge, background removal and crop |
| 4 | MPI-913 | Agent on local Ollama holds VRAM while its own generations run |
| 5 | MPI-905 | Warn when the agent's model has under 64K context |

The member cards stay on the board until their work lands here (umbrella rule). Their
`task.json` descriptions hold the diagnosis; this plan holds the order and ownership.

## Phases

### Phase 1 - A big batch is ONE job to the agent (Fabio, 2026-09-26: FIRST)

His case: his photographer friend dropped **350 photos** into a project, selected them all and
used the right-click **Cue all** (MPI-733) to run one op over every one. If he asks the AGENT to
do that, it must not "look at every single one that comes back and say something about it":
that is tokens gone for nothing. His lean: at the end of a queue, look at nothing.

What MPI-870's fan-out (`_fanOut`, `services/agentLoop.mjs`) does today at 350 cards, read
from the code on 2026-09-26 (MPI-817 session 43718bac):

- **Auto-look is already OFF** for batch items (`!opts.batch` in `settle`). Keep it off.
- **350 chat bubbles**: every item's `settle` emits its own `agent:result`.
- **~14k tokens in ONE wake turn**: every item pushes its own `[Generation finished: ...]` note
  into `_notes`, all read at once when the batch drains, then kept in context until compaction.
- **~6 minutes just to queue, with the chat blocked**: `_fanOut` calls `generate` 350 times in
  a row, and each call races its dispatch against `EARLY_REFUSAL_MS` (1 s) before moving on.

The approved shape (Fabio picked "MPI-941's first phase" for it, 2026-09-26):

1. **One job to the agent.** A fan-out's items settle SILENTLY: no per-item `agent:result`, no
   per-item note. The chat gets ONE progress line, replaced in place by id ("Upscale: 120 of
   350 done"), the way MPI-870 corrects a step label. When the batch drains, ONE note:
   `[Batch finished: <op> over 350 cards: 348 landed, 2 failed: <codes + reasons>]`, and the
   wake turn says one sentence about it.
2. **No looks at all.** The user judges the cards in the gallery. Asked "does anything look
   off?", the agent samples a FEW (say 3), never all: the tool result can say so.
3. **Queue it the way Cue all does.** Validate ONCE (the first item: the model, op, params and
   guide gate are the same for every card; only the media differs), then queue the rest without
   the per-item 1 s refusal race. Better still, ONE renderer job carrying the list, run through
   the same enqueue path `MpiGalleryBlock.js` uses for Cue all (MPI-733, ~line 1532), so an
   agent batch and a right-click batch are one code path. Settle each item by its own job so
   `_inflight` still drains truly and the wake fires once.
4. **Unchanged:** the confirm card above `BATCH_CONFIRM_ABOVE` (5), the spend card for a cloud
   batch (MPI-876), `count` as real batches (`_runBatched`), and no clock on any job (MPI-817).

Footprint: `services/agentLoop.mjs` (`_fanOut`, `settle`, the batch note), the chat's progress
line in `js/components/Compounds/MpiAgentChat/` (check its claim first), and, only for point 3's
one-job path, `js/shell/agentDispatch.js` + `routes/connector.js` (**held by MPI-873 / the
MPI-593 session, claim `71db950c-mpi593-registry`, as of 2026-09-26**: message before touching).
**Verify:** a unit test that a 50-card fan-out emits ONE progress line, ONE drained note and ZERO
looks, and queues in well under a second of loop time; then live, "upscale all of these" on a
real multi-select, and the chat stays one line long.

### Phase 2 - `look` sees videos and GIFs (orphan: message a082a6a6, MPI-593 session)

`services/cardView.js` `viewFile(absPath, { frames: 6 })` is committed in `3bb7c58d`, with
`tests/card-view.test.cjs`. For a still it returns `{ kind: 'image', data }`. For a video or
GIF it returns `{ kind: 'video', data: <one webp contact sheet>, times, columns, duration,
hasAudio }`. In `look` (`services/agentLoop.mjs`, `case 'look'` ~1777): when the ref is a
video or GIF, write the sheet to `cropDir()` as `.webp`, then send it to
`/connector/describe`. The question starts: "This is a contact sheet of <n> frames from a
<duration>s clip, <columns> per row, left to right then top to bottom, at <times>." That is
one describe call per clip, the same cost as a still. Then drop the three "cannot" lines:
the Looking rule (~1417 "it cannot open a video"), the honest limits (~1437 "I cannot watch
videos, see a GIF move"), and the attachment line (~2104 "look cannot open a video"). Keep
"sound is not heard".
**Budget:** the system prompt sits at 10,149 of 10,150 bytes (`tests/agent-prompt-budget.test.cjs`),
so the replacement text must be shorter than what it removes. Run `npm test`, not a subset.
**Verify:** a unit test for the video branch with viewFile stubbed; then live, ask the agent
what happens in a clip.

### Phase 3 - MPI-904: enlarge, remove background, crop with no model

This card is still `idea`, so plan it first. Its description gives the shape: expose resize,
imageUpscale and removeBackground as catalogue ops that `generate` runs with no modelId, each
landing as a new entry on the source card, so the tool schema does not grow. Footprint to
confirm while planning: `services/agentLoop.mjs` (catalogue and generate), `routes/connector.js`
(generate needs a modelId today), the crop-media route (it writes a file with no card entry).

### Phase 4 - MPI-913: release local Ollama before the agent's own local generation

Its description has the fix and the order in which to check things. Check first whether the
agent turn already blocks on the generation. Footprint: `services/agentLoop.mjs`, the agent
routes, and `routes/llm.js` `releaseOwnModels` (reuse it, do not copy it). The copy for "Cosmo
is waiting" is Fabio's draft, so show it to him before it ships.

### Phase 5 - MPI-905: 64K context floor

Two parts. `services/llmEngines.mjs` `OLLAMA_AGENT_CONTEXT` goes from 32K to 64K. The agent
probe in `MpiLlmSettings` reports the context window and warns under 64K, using
`_contextWindowFor`. No `agentLoop.mjs` edit is expected.

## Parallel Batch - Phase 2 and Phase 5

- **Phase 2** - Ownership: `services/agentLoop.mjs`, `tests/agent-loop.test.cjs` (or a new
  `tests/agent-look-clip.test.cjs`), `docs/agent-chat.md`.
  **Verify:** `npm test`, plus a live clip look.
- **Phase 5** - Ownership: `services/llmEngines.mjs`, the `MpiLlmSettings` component files,
  its test. **Verify:** `npm test`, plus the probe warning seen in the app.

Phases 1, 3 and 4 all edit `services/agentLoop.mjs`, as Phase 2 does, so they run one after
another after it and never in a batch with it.

## Current State

2026-09-26: created by the MPI-867 close-out session (8db368e3). Nothing built. It waits for
MPI-817 to close. Same day, MPI-817 session 43718bac: the big-batch fix went in as the NEW
Phase 1 on Fabio's word; the old Phases 1-4 are now 2-5.

## Plan Drift

(none yet)

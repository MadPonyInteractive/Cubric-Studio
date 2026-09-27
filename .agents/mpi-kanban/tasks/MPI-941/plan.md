# MPI-941 plan - in-app agent umbrella 2

**Order, Fabio 2026-09-26: this card STARTS AFTER MPI-817 CLOSES.** He wants the old agent
umbrella finished first, then this one, passed from session to session by handoff. Do not
move this card to `doing` while MPI-817 is still open.

## Members

| Phase | Card | Title |
|---|---|---|
| 1 | none (Fabio, 2026-09-26) | A big batch is ONE job to the agent: one progress line, one report, no looks |
| 2 | MPI-948 (folded in 2026-09-27) | A dragged gallery selection reaches the agent as ONE set chip |
| 3 | MPI-904 (moved up 2026-09-27) | Agent image tools: plain enlarge, background removal and crop |
| 4 | none (orphan) | `look` sees videos and GIFs |
| 5 | MPI-913 | Agent on local Ollama holds VRAM while its own generations run |
| 6 | MPI-905 | Warn when the agent's model has under 64K context |
| 7 | none (Fabio, 2026-09-27) | Clickable options: the agent's choices as buttons, not typed answers |
| 8 | none (Fabio, 2026-09-27) | The spend line counts image analysis and prompt work as ONE "Agent" figure: "Agent · Generations" |

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
looks, and queues in well under a second of loop time; then live, "upscale every card marked with
a dot" (or "all the cards the gallery is showing"), and the chat stays one line long. NOT "these"
on a selection: the agent cannot see the gallery selection until Phase 2.

### Phase 2 - MPI-948: a dragged selection reaches the agent as ONE set (Fabio, 2026-09-27)

Fabio watched the photographer tester work alone. His instinct was to select several cards and
drag them onto the agent box. Today a plain drag carries only the card under the pointer
(`MpiGalleryGrid.js` dragstart, ~1463), so he thinks the agent got 10 and it got 1. Only the
Alt drag out of the app (`_tryNativeDragOut`, ~449) carries the selection.

The agreed shape (Fabio, 2026-09-27):

1. **The drag carries the selection.** A plain dragstart on a card that is IN the current
   selection writes every selected card in click order, the rule `_tryNativeDragOut` already
   uses. They go in as an ADDED field of `application/mpi-media`, for example `cards: [{ groupId,
   itemId, filePath, type, name }]`. The first card's own fields stay as they are, so every other
   drop target (the prompt box, folders) behaves exactly as today.
2. **The chat shows ONE chip**: a layers icon and "N cards", not N thumbnails
   (`MpiAgentChat` drop handler ~1186, `_addReference`). It is removable like any chip, and it is
   redrawn from history with its count.
3. **The agent gets ONE handle.** The set travels by reference, MPI-886's road through
   `routes/agent.js`. The loop registers every card in `_images` and `_groups`, and writes ONE
   attachment line, for example `[Attached set 1: 12 gallery cards (ref: set:<id>). Pass
   ["set:<id>"] as cards to run one op over all of them.]`. `_fanOut` expands a `set:` entry in
   `cards` to its refs, in click order. So 350 cards cost one line in and one short ref out,
   instead of about 60 tokens a card in and 350 refs echoed back. No tool-schema change (budget
   17,180 of 17,200): the attachment line carries the instruction. A set is numbered in the same
   sequence as ordinary attachments.
4. **Phase 1 does the rest**: the confirm card above 5, the spend card, one progress line, one
   report.

Skipped on purpose: a "Send to agent" button on the selection bar (add it only if testers miss
the drag), and letting the agent read the selection without a drop (a selection clears on the
next click, and "these" would mean selected, visible or dropped). `visible_cards` stays the way
to reach a FILTERED set. A dropped set is a HAND-PICKED one.

Footprint: `js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js` (dragstart; **claimed by
the MPI-945 session 202a0927**, 2026-09-27), `js/components/Compounds/MpiAgentChat/MpiAgentChat.js`
+ `.css` (the chip; **claimed by the MPI-946 session 92e48234**), `routes/agent.js`,
`services/agentLoop.mjs`, `tests/agent-loop.test.cjs`, and a desktop spec for the drag. The loop
half (point 3) can start now. The two UI halves wait for those claims to release, or for a
message to their owners.
**Verify:** unit tests showing that a 50-card set is ONE attachment line and that
`cards: ["set:x"]` fans out all 50 in click order; a desktop spec showing that dragging a
selected card drops N; then live, the tester's own gesture: select 12, drag them onto the agent,
"upscale these".

### Phase 3 - MPI-904: enlarge, remove background, crop with no model (moved up 2026-09-27)

Moved ahead of the clip look on Fabio's word, after the Phase 1 live run. Asked to "upscale every
card marked with a dot", the agent could only reach Krea 2 upscale, a diffusion model that
repaints. Its guide wants a prompt per picture, so the agent LOOKED at all 8 cards, wrote 8
prompts and sent 8 separate generates, not one `cards` batch. Then it auto-looked at all 8
results: 16 describer calls, 8 chat bubbles, and Phase 1 never engaged (`app.log` [agent],
2026-09-27 00:15-00:22). A plain upscale needs no look and no prompt. Fabio: pick the upscale
model, `4x-NMKD-Siax` (`assetDeps.js`) for realism and `4x-AnimeSharp` for cartoons, and that is
the whole call. That is the one-op-over-many-cards case Phase 1 was built for, and the
photographer's 350 photos.

This card is still `idea`, so plan it first. Its description gives the shape: expose resize,
imageUpscale and removeBackground as catalogue ops that `generate` runs with no modelId, each
landing as a new entry on the source card, so the tool schema does not grow. The upscale op
takes the upscale model and the factor (the History rail offers x1.5, x2, x3, x4), and its
catalogue entry says when to use Siax and when AnimeSharp. Footprint to confirm while planning:
`services/agentLoop.mjs` (catalogue and generate), `routes/connector.js` (generate needs a modelId
today), `js/shell/agentDispatch.js` (the no-model submit), and the crop-media route (it writes a
file with no card entry).
**Verify:** unit tests showing the catalogue lists the no-model ops and that `cards` fans a plain
upscale out as ONE batch; then live, "upscale every card marked with a dot": one confirm card,
one progress line, no looks, no prompts.

### Phase 4 - `look` sees videos and GIFs (orphan: message a082a6a6, MPI-593 session)

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


### Phase 5 - MPI-913: release local Ollama before the agent's own local generation

Its description has the fix and the order in which to check things. Check first whether the
agent turn already blocks on the generation. Footprint: `services/agentLoop.mjs`, the agent
routes, and `routes/llm.js` `releaseOwnModels` (reuse it, do not copy it). The copy for "Cosmo
is waiting" is Fabio's draft, so show it to him before it ships.

### Phase 6 - MPI-905: 64K context floor

Two parts. `services/llmEngines.mjs` `OLLAMA_AGENT_CONTEXT` goes from 32K to 64K. The agent
probe in `MpiLlmSettings` reports the context window and warns under 64K, using
`_contextWindowFor`. No `agentLoop.mjs` edit is expected.

### Phase 7 - Clickable options (Fabio, 2026-09-27)

When the agent offers two or three options ("Want me to rename the upscaled cards, or anything
else?"), the user clicks one instead of typing it. The live run on 2026-09-27 ended on exactly
that kind of question. Plan it first. The confirm card (`_appendConfirm` in `MpiAgentChat.js`,
`agent:confirm`) is the UI to reuse: buttons on a card, answered by one click, and redrawn from
history. The open design choice is how the agent marks its options. A tool (`ask`, answered like
the confirm card) is explicit, but both budgets are full (system prompt 10,146 of 10,150, tool
schemas 17,180 of 17,200), so it must remove as much text as it adds. Parsing a numbered list
out of the reply costs no budget, but it is a guess. Clicking a button sends that option as the
user's next message. Watch-only item from MPI-817: the agent ending an Auto-mode turn on a
question; buttons make such a question cheap to answer, not a reason to ask more of them.
Footprint: `services/agentLoop.mjs`, `js/components/Compounds/MpiAgentChat/MpiAgentChat.js` +
`.css` (**claimed by the MPI-946 session 92e48234**, 2026-09-27), `tests/agent-loop.test.cjs`,
`tests/agent-prompt-budget.test.cjs` (**claimed by the MPI-944 session 1bef7b92**).
**Verify:** a unit test for the options event and its answer; then live: an offer shows buttons,
and one click continues the turn.

### Phase 8 - The spend line counts image analysis and prompt work as AGENT (Fabio, 2026-09-27, revised)

Today the panel reads "Chat $x · Generations $y" (`_setSpend`, `MpiAgentChat.js`), and a `look`'s
describer call is not counted at all (the ponytail note on `_addSpend`, `services/agentLoop.mjs`:
the describe route returns no usage). In the 2026-09-27 run, 16 describer calls cost about a
third of a cent that no line showed.

**Revised shape (Fabio, 2026-09-27, same session as Phase 2):** ONE agent figure, no third item.
"The agent does all that anyway": its chat, image analysis (`look`, box measuring) and prompt
enhancement all add to the SAME bucket, and the label "Chat" becomes "Agent": "Agent $x ·
Generations $y". The earlier "Chat · Gens · Analysis" split is dropped, and so is the "Gens"
rename, which only existed to make room for a third item (assumed; Fabio did not say). Read
DeepInfra's `usage.estimated_cost` off the describe reply the way chat already does
(`/connector/describe` → `/llm/describe`) and add it to the existing chat bucket (`chatUsd`, or
renamed `agentUsd` if the rename stays small). The dictated "content announcement" question is
moot: whatever the agent's run spends that is not a generation lands in Agent.
Footprint: `services/agentLoop.mjs` (`_addSpend`, `look`), `routes/connector.js` +
`routes/llm.js` (pass usage back), `js/components/Compounds/MpiAgentChat/MpiAgentChat.js`,
`tests/agent-loop.test.cjs`.
**Verify:** a unit test that a `look` with usage adds to the agent bucket and emits `agent:spend`;
then live: the Agent figure rises after a look.

## Parallel Batch - Phase 4 and Phase 6

- **Phase 4** - Ownership: `services/agentLoop.mjs`, `tests/agent-loop.test.cjs` (or a new
  `tests/agent-look-clip.test.cjs`), `docs/agent-chat.md`.
  **Verify:** `npm test`, plus a live clip look.
- **Phase 6** - Ownership: `services/llmEngines.mjs`, the `MpiLlmSettings` component files,
  its test. **Verify:** `npm test`, plus the probe warning seen in the app.

Phases 1, 2, 3 and 5 all edit `services/agentLoop.mjs`, as Phase 4 does, so they run one after
another and never in a batch with it.

## Current State

2026-09-26: created by the MPI-867 close-out session (8db368e3). Nothing built. It waits for
MPI-817 to close. Same day, MPI-817 session 43718bac: the big-batch fix went in as the NEW
Phase 1 on Fabio's word; the old Phases 1-4 are now 2-5.
Same day, session 545693a9: **MPI-817 and MPI-774 closed.** Start here with Phase 1. The agent
now forgets its own notes (`write_memory` `delete: true`, 50 a list): budgets are unchanged, tool
schemas 17,180 of 17,200, system prompt 10,146 of 10,150.

2026-09-27, session a8643a90: card in `doing`. **Phase 1 is built and unit-green, and waits on
Fabio's live check**: mark 10+ cards with the dot and ask "upscale every card marked with a dot".
The agent cannot see a gallery SELECTION yet, so "these" does not work until Phase 2. Expect one
confirm card above 5, then ONE chat line counting up ("upscale with X: n of N done"), no result
card per image, and one short wake sentence at the end with no looks. Next after his OK: Phase 2,
MPI-948 folded in the same day on Fabio's word. Its loop half can start at once; its drag and
chip halves wait on the MPI-945 and MPI-946 claims. The `docs/agent-chat.md` row is still pending
(Plan Drift). Old Phases 2-5 are now 3-6.
Later the same night: the live run upscaled fine but never used `cards` (see validation.md), so
Phase 1's live proof waits on a prompt-free op. MPI-904 moved up to Phase 3; the clip look is
Phase 4. Order now: 1 batch (built), 2 drag set (MPI-948), 3 plain upscale/cutout/crop
(MPI-904), 4 clip look, 5 MPI-913, 6 MPI-905, 7 clickable options, 8 the spend line counts
analysis (Phases 7 and 8 were folded in by Fabio the same night).
**NEXT (handoff 2026-09-27):** Phase 2's loop half, red first: the `set:<id>` handle in
`services/agentLoop.mjs` (register the set's cards, write one attachment line, expand `set:` in
`cards`), with `routes/agent.js` if the set arrives there. Its drag and chip halves only once the
MPI-945 and MPI-946 claims have released, or after messaging their owners. Then plan and build
Phase 3 (MPI-904 plain upscale); its live run is Phase 1's live proof.
2026-09-27, session c0103e59, end: **Phases 1 and 2 are DONE** (Fabio "1"; checklist ticked).
The rules maps are updated with his permission. **NEXT: Phase 3 (MPI-904). Plan it first**
(no-model upscale with Siax or AnimeSharp, background removal, crop, as catalogue ops that
`generate` runs with no modelId, each landing as a new entry on the source card). All of it is
uncommitted until handoff or close, and this session's claim `c0103e59-mpi941` holds the files.
Before that: **Phase 2 live-checked by Fabio: it works** (3 cards, one set
chip, one KleinEdit batch line, one report; Phase 1's batch path was also live for the first time).
Two fixes followed: the bubble chip's contrast, plus a composer flex basis that scrolled one chip;
and the set line now says where an edit lands. His "NEW cards" wish (an edit as a new card, not
the next version) was DROPPED with his agreement, because the tool schema is full. A quick
re-check of the chip is left, then Phase 3.
Earlier the same session: **Phase 2 is built and green, and waits on Fabio's live drag**
(validation.md § Phase 2). Both UI halves went in too, because the MPI-945 and MPI-946 claims had
closed. The `docs/agent-chat.md` batch row landed here, and message c95ee93e is resolved. Phase 8
was revised by Fabio before any of it was built: ONE "Agent" figure. **NEXT:** once Fabio has
done the live drag, plan Phase 3 (MPI-904, plain upscale). Its live run is Phase 1's live proof.
A set's cards are not listed to the agent one by one, so "mark these" or "look at these" on a set
cannot name a card; only `cards` takes a set. Add a way in only if a live run needs it.
**Noticed, not built:** with a batch in flight, `cancel_generation` lists every in-flight item in
its "Still in flight" text (349 ids), and there is no "cancel the whole batch". The user's Stop in
the app covers the need today.

2026-09-27, session cefc4ae6, end: **Phase 3's plain upscale WORKS live** (Fabio's 6 dotted cards:
one confirm, one line, no looks, each on its own card; validation.md live try 2). After it: Lingo no
longer stands in for a tool run (`noPrompt`), and a tool's result says it lands as the card's next
version. **NEXT:** Fabio live-checks those two plus "remove the background of this one" and "crop this
to square"; then tick Phase 3, close MPI-904 as folded in, and go to Phase 4.
Earlier the same session: **Phase 3 (MPI-904) is built and green, and waits on Fabio's live
check** (validation.md § Phase 3 has the brief: "upscale every card marked with a dot"). A tool is a
`generate` with no `modelId` and no `flowId`: `imageUpscale`, `removeBackground`, `crop`, settings in
`fields`, defined once in `js/shell/agentToolOps.js`. Uncommitted until handoff/close; claim
`cefc4ae6-mpi941` holds the files (it took over `c0103e59-mpi941`). **NEXT after his "1":** tick the
checklist, close MPI-904 as folded in, then Phase 4 (clip look). If the live run sends "remove the
background" to an edit model, reword the system prompt's Model rule at no net byte cost first.

**Watch-only, carried from MPI-817 (no build unless it recurs):** the agent ending an Auto-mode
turn on a question; a note generalising from two runs; a project note RESTATING a global one
(Fabio's `characters.md` copied "3D cartoon (global preference)", so forgetting the global note left
the copy); Ollama's free cloud models (unconfirmed research); the `__ARG__` project (Fabio's to delete).

## Completed

- **Phase 1 code (2026-09-27, session a8643a90), uncommitted until handoff/close:** `_newBatch` in
  `services/agentLoop.mjs`, used by `_fanOut` and `_runBatched`. Tests: `(l)` "fifty cards are ONE
  job" and "a batch with failures" in `tests/agent-loop.test.cjs`. Red first: fifty cards took
  50.4 s to queue. Green: about 1 s (one refusal race). Full `npm test`: 1997 pass, 0 fail. Live
  check is Fabio's (below).
- **Phase 2 code (2026-09-27, session c0103e59), uncommitted until handoff/close:** `_sets` plus the
  set attachment line in `runTurn`, and `set:` expansion at the top of `_fanOut`
  (`services/agentLoop.mjs`); the set branch in `routes/agent.js`; `cardReference` sets
  (`js/utils/mediaActions.js`); `_dragCards` at both dragstarts (`MpiGalleryGrid.js`); the set chip
  (`MpiAgentChat.js` + `.css`). Tests: `(l)` set case, two in `agent-card-reference.test.cjs`, and
  `tests/desktop/agent-drag-set.spec.js`. Live check is Fabio's.
- **Phase 3 code (2026-09-27, session cefc4ae6), uncommitted until handoff/close:** new
  `js/shell/agentToolOps.js`; `_submitTool` + the shared `_enqueueAgentRun` tail and `tools` in
  `_listModels` (`js/shell/agentDispatch.js`); the operation-only branch in `routes/connector.js`;
  `tools` in `compactCatalogue` / `catalogueEntry` / `_rememberGuides`, `fields` on a tool call, no
  auto-look on a tool, no `follow` on a batch item, `_opLabel` (`services/agentLoop.mjs`); the
  `NOT_A_GIF` refusal points at the tools (`js/shell/gifJobs.js`). Tests: `agent-tool-ops.test.cjs`,
  the relay tool case, two `(l)` cases, `tests/desktop/agent-tool-ops.spec.js`. Live check is Fabio's.

## Plan Drift

- 2026-09-27: point 3's "better still" (one renderer job through Cue all's path) was NOT needed.
  An agent item already reaches `enqueueGeneration` through `agentDispatch._submitGeneration`, the
  same function Cue all calls. The six minutes were the loop's own per-item 1 s race plus an awaited
  ledger write per item. So Phase 1 touched no `agentDispatch.js`, `connector.js` or
  `MpiGalleryBlock.js`. The chat needed no edit either: `_appendTool` already replaces a line by id,
  and the history repaint does the same.
- 2026-09-27: folded in a ledger bug. `_trackUnfinished` keys on model plus prompt, so every batch
  item shared ONE entry, and the first to land erased it while the rest still ran. The batch now
  writes one entry, which ends holding only the failed cards (or `count` = failed runs).
- 2026-09-27: small fan-outs (2 to 5 cards) and `count` batches are silent too. Fabio can veto
  that: one code path, and the gallery shows the cards.
- 2026-09-27, live check: "Run this 8 times?", Yes, then GENERATION NOT STARTED, a guide read, and
  the SAME card again. Root cause: the `cards` fan-out ran before the guide and masking gates, so
  a model-wide refusal landed after the user's Yes. Fixed in `generate`: the fan-out now sits
  after those two gates and before the per-picture media gate. Test: "(l) an unread guide
  refuses a batch BEFORE the user is asked", red first.
- 2026-09-27: MPI-948 folded in as the new Phase 2, on Fabio's word. It is the INPUT half of
  Phase 1: the tester dragged a selection onto the agent box, and the drag carried one card. The
  shape moved from a selection-bar button to the drag. Old Phases 2-5 are 3-6.
- 2026-09-27 (session c0103e59): Phase 8 revised by Fabio before any of it was built. One
  "Agent" figure holds chat, analysis and enhancement; no separate Analysis item, no "Gens".
- 2026-09-27 (session cefc4ae6), Phase 3 as approved by Fabio ("go" on the brief): crop is the
  existing `resize` op in its `crop` mode (a ratio + position), NOT the `crop-media` route, which
  writes with Sharp behind an open History workspace (the block never re-reads its group, so its
  next save drops the entry). Box crop ("crop to her face"), exact-size resize, flip and rotate are
  out. A batch item no longer sends `follow` (fifty navigations). The MCP `generate` schema and docs
  are untouched (MPI-593's); the route now serves tools to any caller.
- 2026-09-27, Fabio's first live try: the tool was never picked. `GET /connector/models` dropped
  `tools`, and Krea 2's upscale held `best: true`. Folded in: the route forwards `tools`, and
  `modelPriority.js` ranks the plain upscale first for `upscale` (Krea 2 rank 2, with a note).
  Footprint grew by `js/data/modelConstants/modelPriority.js` + `tests/model-priority.test.cjs`.
- 2026-09-27: the `docs/agent-chat.md` `generate` row still needs a one-line mention. MPI-944
  (1bef7b92) claimed the file after this card took it; message c95ee93e asks them to release it
  or add the row.

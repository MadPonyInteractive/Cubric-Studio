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
| 9 | none (Fabio, 2026-09-27) | The agent cleans up after itself: cancels a run the user replaced, knows model strengths, crop takes a plain ratio |
| 10 | MPI-955 (Fabio, 2026-09-27) | History's prompt box vanishes when the selected image model takes no image: no Cue, no Stop, no model picker |
| 11 | none (Fabio, 2026-09-28) | The Ollama agent picker says which local models were tested, and hides the ones that cannot call tools |
| 12 | none (Fabio, 2026-09-28) | "Benchmark this model": the user runs our agent test suite on the model they picked |

**Umbrella rule (Fabio, 2026-09-27): every new card this work spawns is added to this table and gets a
phase, so nothing is orphaned or left behind.**

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

### Phase 9 - the agent cleans up after itself (Fabio's Phase 3 live run, 2026-09-27)

Found live in "Deepinfra model tests" (app.log [connector], 10:16-10:26). Fabio's standing constraint:
tokens down. A fact lives in ONE home, and a line is paid for only when it applies; the always-on system
prompt does not grow (10,093 of 10,150).

1. **A run the user replaced keeps running.** 10:24:57 the WAKE turn re-sent `krea2Edit` on its own, 4 s
   after its auto-look at edit_010; Fabio's "try Klein 9B" landed as `kleinEdit` at 10:25:08 and queued
   behind it. Root cause: on a user turn the agent is never told that a job of its own is still running,
   and `cancel_generation`'s description covers only "take it back". Fix: the user turn's opening lines
   (`opening`, ~2390 `services/agentLoop.mjs`) get ONE line only while `_inflight` is non-empty, e.g.
   `[Running now: krea2Edit on edit_010 (toolCallId X). If the user's new ask replaces it, cancel it first.]`.
   Zero bytes on every other turn.
2. **Model strengths live in the index, not in rules.** `js/data/modelConstants/modelPriority.js` IS the
   index Fabio asked for: ranks per task plus `NOTES`, surfaced by `list_models` as `rank`, `best` and
   `note` on each op. What it lacks is his knowledge:
   - `krea2:krea2Edit` note says "strong on realism". Fabio: NOT a native editor (it re-renders); it keeps
     an anime or stylised look better than kleinEdit. Rewrite the note to say so.
   - Skin detail (Fabio, corrected 2026-09-27 after a live Krea test; supersedes "Chroma for skin"): krea2
     gives the BEST skin on detail/upscale at LOW denoise (the default 20); higher denoise changes the
     character more. Chroma's denoise changes the character LESS, so it is the pick when identity matters
     more than peak skin. Skin detailing needs the prompt to ask for it ("high skin detail, visible
     pores"). All of it as NOTES on those ops; NO rank change (Fabio: "forget about Chroma" ranking).
   - ONE generic line, not per model, in the `list_models` header (`compactCatalogue` `detail`, paid only
     when the agent lists models): a miss moves to the next rank for the task, never the same op again.
   - Offer Fabio a pass where he dictates each model's strengths; `NOTES` takes them.
3. **Crop cost two refusals** ("Generation not started" x2 before "Reading crop's settings"). Likely the
   agent passed `ratio` top-level, as models take it, and the tool route refuses a named param on a tool.
   The log does not record the refusal: confirm with a unit test first. If so, the tool takes a top-level
   `ratio` as `fields.ratio` (code, zero tokens).

Footprint: `services/agentLoop.mjs`, `js/data/modelConstants/modelPriority.js`, `routes/connector.js`,
`js/shell/agentToolOps.js`, `tests/agent-loop.test.cjs`, `tests/model-priority.test.cjs`,
`tests/agent-tool-ops.test.cjs`, `tests/agent-generation-relay.test.cjs`, `docs/agent-chat.md`.
**Verify:** red-first unit tests (an in-flight job adds the line and a quiet turn does not; the notes and
header reach the catalogue; a top-level ratio crops); budgets unchanged; then live: start an edit, and
while it runs say "no, use Klein instead" (expect a cancel, then Klein alone).

### Phase 10 - MPI-955: History's prompt box survives a text-to-image model (Fabio live, 2026-09-27)

In an image card's History the Prompt tool was greyed out ("No prompt-driven ops available for this
model"), so Fabio could not stop a running generation. `MpiGroupHistoryBlock` takes the gallery's selected
image model (`resolveActiveModel('image')`); a model with no op that takes an image (likely a DeepInfra
text-to-image model in that project) leaves `_hasPromptOps()` false, so the prompt box never mounts, and
Cue/Stop and the model picker live inside it. Fix: image History offers only models that take an image, as
video History already does with its i2v filter (`_promptModelFilter`, ~311), falling back to the first
eligible model. Footprint: `js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js`, a new
desktop spec. **Verify:** the spec selects a t2i-only image model, opens History, and finds the prompt box
on the first eligible model; then live.

### Phase 11 - the Ollama agent picker is honest (Fabio live, 2026-09-28)

Fabio, on the Ollama connection: the enhancement row carries "(recommended)", the agent row nothing, "as a user
I would have no idea what to pick". Added on his "yes, add Phase 11". **Not a recommendation:** MPI-912
(`validation.md` § 3-4) already ran `scripts/agent-test.mjs --preset ollama` and no local model met the bar
(DeepSeek's 22/22 x3): gemma4:12b 14/22, ornith:9b 11/22, qwen3.5 9/22, gemma-4-abliterated:12b 2/22, all `--runs 1`
on the 22-case suite. His 2026-09-26 picker rule (docs/llm.md § `agentTest`) is the shape: every tested model on top
with its score and cost, no "(recommended)". Three parts:
1. **Scores:** `agentTest` entries with `jobs: []` on the `ollama` table (`services/llmEngines.mjs`
   `RECOMMENDED_REMOTE_MODELS`), re-measured on the CURRENT suite (it grew, and the Options rule is new), perChat $0.
   Needs his GPU free: `npm run agent:test -- --preset ollama --model <tag> --runs 1` per model, under the GPU lease.
2. **No tools, not listed:** a model whose Ollama `/api/show` capabilities lack `tools` cannot be the agent at all
   (docs/agent-chat.md caveat: "the picker shows no way to tell them apart"). Filter it out of the agent row only.
3. **Stale value:** the Ollama agent box showed `deepseek-ai/DeepSeek-V4-Flash-0731` (a DeepInfra id) while ornith:9b
   ran. Find where the row reads its saved pick.
Footprint: `services/llmEngines.mjs`, `routes/llm.js` (models + capabilities), `MpiLlmSettings` (agent row),
`tests/llm-connection.test.cjs`. **Verify:** unit tests for the filter and the scored rows; then Fabio opens the
Ollama agent row and sees scores on top, no tool-less models, and his real pick.

### Phase 12 - "Benchmark this model" (Fabio, 2026-09-28)

His idea: under Settings > Remote's "Test tool use" button, a "Benchmark this model" button with a line saying what it
is, which runs our agent suite on the selected model and shows how many tests it passes. Feasible (answered "yes"):
`scripts/agent-test.mjs` runs the REAL loop against FAKE tools and a captured models fixture, no app, no generation.
Plan it first. Open points: (a) the harness and `tests/fixtures/agent/` are repo-only today; they must ship in the
build (check the portable packaging's file list) and run server-side (a route streaming progress, not a child
`npm run`); (b) money: a paid model's suite is about $0.06-0.36, so a spend card with the estimate before it runs;
(c) time: a local model is 10-30 min and holds the GPU, so a progress line, a Stop, and the Phase 5 release rules;
(d) the result: store it per connection+model and show it in the agent row the way `agentTest` scores show (Phase 11's
display), marked as the user's own run; `--runs 1`, never presented as our certified 3-run bar. Reuse Phase 11's
scored-row code; build 11 first.
(e) **share, opt-in** (Fabio, 2026-09-28): after a run, a tickbox "Share this result (anonymous: model, score, GPU)",
asked per run or once, never on by default; it POSTs one record to our endpoint (**MPI-965**: the Worker, storage and
read side live there). Record: provider + model id, a hash of the suite (22 -> 26 cases already, so only the same suite
compares), per-case pass/fail, runs, perChat, app version, GPU name + VRAM for a local model. Never prompts, replies,
images, project names or paths. No GitHub token in the app. Update cubric.studio/privacy in the same job. Order:
result -> local save -> optional share; the share ships only once MPI-965's endpoint is live.
Packaging found 2026-09-28: `build-portable.mjs` `APP_COPY_EXCLUDES` drops `scripts/` and `tests/` whole (146, 148), so point (a)
means moving the cases + `tests/fixtures/agent/` (56 KB) into shipped paths. `runChecks` stays put: only `--samples` uses it.

**Build plan (session 7fe5b9b0, 2026-09-28; awaiting Fabio's go).** Zero agent prompt bytes: the benchmark is outside the
agent's prompt. The share (e) is NOT built here: it ships once MPI-965's endpoint is live (a later phase or MPI-965 itself).
- **12a - the harness ships.** New `services/agentBench.mjs`: the fixture assembly, `fakeTools`, `CASES`, `converse`, and
  `runSuite({ loopOptions, profileId, model, onProgress, signal })` (every case once, `--runs 1`; returns per-case pass/fail,
  usage, `suiteHash` = a hash of the case ids + check sources). Fixtures move `tests/fixtures/agent/` -> `services/agentBench/`.
  `scripts/agent-test.mjs` becomes the CLI over it (flags, 3 runs, `--bite`, `--samples`, `--preset`, pricing unchanged).
  **Verify:** `npm run agent:test -- --case options-ideas --runs 1` still passes (~$0.001); a unit test that
  `agentBench.mjs` imports nothing under `scripts/` or `tests/` (what the portable copy drops).
- **12b - the route.** `POST /agent/benchmark { profileId, model }` streams SSE: `bench:start { cases, estimate }`, one
  `bench:case { id, title, passed, failures }` per case, `bench:done { passed, cases, costUsd, perChat, suiteHash }` or
  `bench:error`; `POST /agent/benchmark/stop` aborts. One at a time. `AgentSessions.benchmark()` builds the loop from the
  sessions' own `_loopOptions` (the user's saved connection and key) with the FAKE tools. Cost = provider usage x DeepInfra's
  live price (`fetchDeepInfraPrices`); a provider with no price reports tokens only. A local model: refused while a local
  generation runs (the GPU is busy), and released after (`releaseOwnModels`, Phase 5's rule).
  **Verify:** `tests/agent-bench.test.cjs` with a scripted engine: events in order, stop aborts mid-suite, one-at-a-time.
- **12c - the button.** Settings > Remote, under "Test tool use": "Benchmark this model" + one hint line ("Runs our 28 agent
  tests on this model with pretend tools: nothing is generated or saved."). Click -> an inline confirm in place of the button:
  "About $0.10 on DeepInfra, ~7 min" / "Uses your GPU for 10-30 min" with Run / Cancel (no modal). Running -> a progress line
  "12 of 28 · 9 passed" and a Stop. Estimate = measured per-case tokens (DeepSeek, this suite) x the live price, labelled "about".
- **12d - the result.** `Storage` keeps `{ [profileId]: { [model]: { passed, cases, perChat, suiteHash, at } } }` (the
  `getConnectionPick` pattern). The agent row shows it like Phase 11's scores, marked "your run": "21/28 tests (your run)". A
  model we scored keeps our 3-run score; the user's own sits beside it, never replacing it. A result from an older suite
  (hash differs) reads "older tests".
Footprint: `services/agentBench.mjs` + `services/agentBench/` (new), `tests/fixtures/agent/` (moved out), `scripts/agent-test.mjs`,
`services/agentSessions.mjs`, `routes/agent.js`, `js/core/storage.js`, `MpiLlmSettings.js` (+ `.css`), `tests/agent-bench.test.cjs`
(new), `tests/desktop/llm-settings-remote.spec.js`, `docs/llm.md`, `docs/agent-chat.md`.
**Verify:** 12a-b as above; desktop spec: button -> confirm -> progress -> score in the agent row (route stubbed); `npm test`;
then Fabio live: one DeepSeek run from Settings (~$0.10), the score appears on the row.

### Phase 13 - the loop stops a repeated identical call (Fabio, 2026-09-28: "fold the write_memory guard into MPI-941")

Found in the Phase 11 score run: gemma4:12b sent `write_memory({file: "woman_desc.md", ...})` 15 times in ONE turn. Every
call was refused (`BAD_REQUEST`: an underscore fails the slug check) and the model resent it unchanged, burning 128K prompt
tokens. Nothing reached disk (harness fake store; Fabio's global notes checked, untouched). Fix in `services/agentLoop.mjs`'s
tool loop: a call identical to one already made THIS TURN (same tool, same parsed args) is not run again; its result says
so and carries the earlier result, so the model must change the arguments or stop. Tool-result text only, no system-prompt
bytes. Footprint: `services/agentLoop.mjs`, `tests/agent-loop.test.cjs`. **Verify:** a scripted model repeating one refused
call gets it run ONCE (red first); a legitimate second call with different args still runs.

## Parallel Batch - Phase 9 and Phase 10

- **Phase 9** - Ownership: the Phase 9 footprint above. **Verify:** as Phase 9.
- **Phase 10** - Ownership: `js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js`,
  `tests/desktop/history-prompt-model.spec.js` (new). **Verify:** as Phase 10.

Check live claims on `MpiGroupHistoryBlock.js` before dispatch.

## Parallel Batch - Phase 4 and Phase 6 (DONE 2026-09-27)

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

2026-09-27, session 5b8e4d8c: **`downscale` folded into Phase 3** on Fabio's word (a megapixel target,
the rail's `resize` op at its MP size, refuses to enlarge; validation.md). Unit + desktop green,
uncommitted, claim `5b8e4d8c-mpi941`. Same session: **Phase 3 VERIFIED by Fabio ("1")** on the one-run live
brief (no Lingo, "next version", remove background via the tool, crop to square, downscale to 1 MP). MPI-904 and
MPI-948 closed as folded in. **NEXT: Phase 4 (look sees clips)**, a Parallel Batch with Phase 6.

Same session, later: **Phases 4 + 6 built by a parallel batch**, unit + desktop green, live check pending
(validation.md). Fabio's live run of Phase 3 also found four agent problems (not cancelling a superseded
run, re-trying a model that just missed, crop refusals, and History's prompt box vanishing with a t2i-only
model selected): triaged, fix plan offered, waiting on his "go" before any of it is built.

Same session, end: **Phases 4 and 6 VERIFIED by Fabio** (screenshots: a clip described from its frames;
"1M context" on DeepSeek, "32K context" + the warning on Qwen 72B). MPI-905 closed as folded in. His Phase 3
run's four problems became **Phase 9** (agent cleans up after itself) and **Phase 10 = new card MPI-955**
(History prompt box), both approved ("go", with MPI-955 on the umbrella). **NEXT: the Parallel Batch
Phase 9 + Phase 10**, then Phases 5, 7, 8. Ask Fabio before ranking Chroma first for `detail`.

2026-09-27, session 575c1f1a: CI green on 7b9c77aa8 (one shard re-run after an Electron-download 500);
the MPI-904/905/948 close pushed as `3ba17b3c3`. **Phases 9 + 10 built by a parallel batch, unit + desktop
green, uncommitted, claim `575c1f1a-mpi941`; live check pending** (validation.md § Phases 9 and 10 has the
brief). Fabio corrected the Chroma premise mid-build: no rank change, krea2 is the best skin at low denoise,
Chroma keeps the character more (notes only). **Phases 9 + 10 VERIFIED by Fabio** ("Everything works",
screenshots: a Klein edit cancelled for Krea on his word; crop 8:5 started first call). Checklist ticked;
MPI-955 `validating`. **NEXT:** commit Phases 9 + 10 code, close MPI-955 once CI is green on it (separate
commit, done-gate), then Phase 5 (MPI-913, local Ollama holds VRAM), 7 (clickable options), 8 (one Agent
spend figure). Noticed, not built: the agent claims a tool needs no GPU (the "with no model" tool notes).

2026-09-27, session 2f2883e4: CI green on 6f4105a8c; **MPI-955 closed** (`8453482c4`, private index). **Phase 5
(MPI-913) built and unit-green, uncommitted, claim `2f2883e4-mpi941`; MPI-913 in `doing`; live check pending**
(MPI-913 validation.md has the brief). The agent's generate never blocked, so both halves were needed: release
at dispatch AND a waiting line (Fabio picked the tighter copy) with the turn ending instead of a second round.
Same session: **Phase 8 built and green** (one wrapper `_look` adds the describer's `costUsd` to `chatUsd`; the
label reads "Agent"; full `npm test` 0 fail). **Phase 7 brief given to Fabio** (recommended: an `[options: A | B]`
reply marker hidden like `[declined]`, buttons in the chat, net-zero system-prompt bytes). **NEXT:** his live
check of 5 + 8 and his call on 7's shape; then build 7.
2026-09-28, same session: **Phase 7 built and green** on Fabio's "go with the marker" (validation.md § Phase 7; system
prompt 10,088, net -5). **All phases are built. NEXT:** Fabio's one live check of 5, 7 and 8; then tick them, close
MPI-913 (after CI on its code commit), and close MPI-941 via `mpi-end-session`.
Same day, later: **Phase 5 VERIFIED** (ornith:9b; Ollama's server.log shows no agent reload during the render) and a
duplicate waiting line found and fixed (`_waitForGpu` draws only with no line open). **Phase 8 VERIFIED** on DeepInfra
("Agent $0.006 · Generations $0.0005"). Phase 7's buttons NOT yet seen live: ornith:9b ignored the marker at a real
fork, and the DeepInfra run had no fork. **Phase 11 added** (Fabio: "yes"). **NEXT:** Fabio's fork check on DeepInfra
("make an image with SDXL"), Phase 11's go, and its scores need his GPU free.
**Handoff (Fabio, 2026-09-28):** he said go on the score test, in a FRESH session. Phase 12 added (his benchmark button,
answered "feasible"). **NEXT session:** (1) Phase 11 parts 2+3 (no GPU), then part 1's scores: `npm run agent:test --
--preset ollama --model gemma4:12b --runs 1` and `ornith:9b`, ask Fabio first that the GPU is free; (2) plan Phase 12;
(3) his Phase 7 fork check is still owed. Phases 5, 7, 8 + the duplicate-line fix are UNCOMMITTED at handoff time
unless the handoff commit below took them.
2026-09-28, session ab46115b: CI green on 1c1c83574; **MPI-913 closed** (`266387788`, private index, pushed).
**Phase 11 parts 2 + 3 built, unit + desktop green, uncommitted, claim `ab46115b-mpi941`; live check pending.**
Part 3's root cause was wider than the agent box: ALL THREE Remote picks (agent, enhance, describe) were one global
value, so a DeepInfra pick reached Ollama. Now `{ [profileId]: id }` (`Storage.getConnectionPick`/`setConnectionPick`,
`getAgentPrefs` keeps its `{ model, mode }` shape). A pre-map pick reads as none (one re-pick; deliberate). Part 2:
Ollama's `/api/tags` carries `capabilities` (no per-model `/api/show`), so `listRemoteModels` sets `tools`/`vision`.
Same session: **part 1 scored under the GPU lease**: ornith:9b 16/26, gemma4:12b 13/26 (`--runs 1`, 26 cases), both on the
`ollama` table as `jobs: []` + `agentTest`. Phase 12 gained point (e) share, opt-in, and **MPI-965** (the endpoint) was
opened on Fabio's yes. **All of Phase 11 is built. NEXT:** Fabio's live check (validation.md § Phase 11: picks per
connection, no tool-less rows, the two scores on top with "runs on your GPU"); his Phase 7 fork check; then plan Phase 12.
Later: **Phase 11 VERIFIED by Fabio ("1")**. His screenshots also **FAILED Phase 7 live on DeepSeek**: two genuine
three-way forks ("What would you like?" after a declined SDXL install; "Any of these sound good?" after three scene ideas),
no buttons. Phase 7's evidence was a scripted model only; no real model was ever measured on the marker. Phase 13 (the
repeated-call guard) folded in on his word. **NEXT:** an `agent-test.mjs` case for the Options rule, red on DeepSeek, then
reword the rule at net-zero bytes until it passes x3; Phase 13; then plan Phase 12.
2026-09-28, session 7fe5b9b0: CI green on 88abc7e58 (contains 31282263b, which had no run of its own). **Phase 7 fix built
and measured on DeepSeek:** new agent-test cases `options-after-decline` + `options-ideas` RED first (1/3, 0/3), GREEN 3/3
after the rule reword (net -4 bytes) AND the four decline tool results naming the marker; full suite 28 x3 84/84, $0.30.
**Phase 13 built** (a refused call resent unchanged, nothing between, answers `REPEATED_CALL`; narrowed on purpose, Plan
Drift). Unit, full `npm test` (0 fail), lint green. All UNCOMMITTED, claim `7fe5b9b0-mpi941`. **Phase 7 VERIFIED by Fabio
live** (decline -> three buttons, one click continued; the same turn showed the guide gate's resend still runs under the
Phase 13 guard). Phase 12's build plan written (§ Phase 12) and approved: "go, inline confirm, share later".
**12a BUILT and green** (validation.md § Phase 12a): `services/agentBench.mjs` + `services/agentBench/` fixtures, the CLI over
it, `tests/agent-bench.test.cjs`. **NEXT: 12b** (the `POST /agent/benchmark` SSE route + stop, `AgentSessions.benchmark()`
from `_loopOptions` with the fake tools, one at a time, local: refuse while a local generation runs, release after), then 12c
(button, inline Run/Cancel confirm, progress + Stop), 12d (result per connection+model, "(your run)" on the agent row).
**Anime through styles DONE on Fabio's yes** (validation.md § Anime through styles): `docs/agent/formats.md` + the two ILL notes
in `modelPriority.js`; and the suite's fake `generate` now resolves a style label like the route does (it refused every label).
**Handoff 2026-09-28 -> fresh session for 12b.**
2026-09-28, session 4143bc2a: **12b, 12c, 12d BUILT and green** (validation.md § Phase 12b, § 12c + 12d): the routes
(`GET`/`POST /agent/benchmark`, `/stop`), `AgentSessions.benchmark` (probe first, `runSuite`, one at a time, local: GPU_BUSY on a
busy engine queue, released after), the Settings button (inline Run/Cancel over the estimate, progress + Stop), and the result
"(your run)" beside our score on the agent row, kept by `agentService`. Uncommitted, claim `4143bc2a-mpi941`. Card `validating`.
**NEXT:** Fabio's live run from Settings on DeepSeek (~$0.10, ~7 min), then tick Phase 12 and close MPI-941 via `mpi-end-session`
(the share, point e, goes to MPI-965).
Same session, Fabio's review: the user's run now REPLACES our score (reverses 12d's "beside, never replacing"); `suiteHash`
covers the tests only; DeepSeek re-stamped 28/28; stale scores read "(older tests)"; a tool-less model stops at the probe.
2026-09-29: gpt-oss re-scored on his yes: 19/28 ($0.054, ~15 min), stamped; the Settings estimate now 30 s a test ("~14 min").
Qwen3.6 and the Ollama pair still read "(older tests)" (no go on those). His "workflows" idea became **MPI-970 "Routines"**
(todo/idea, brief.md holds his decisions: name, missing model/Flow refuses to run, agent-free entry later); brainstorm it
after MPI-941 closes. storage.js + storageKeys.js committed early (`8cd26fbc0`) and released to MPI-595 on its request.
**Handoff 2026-09-29. NEXT:** Fabio's live benchmark run on DeepSeek (~$0.10, ~14 min; his app was restarted on the
pre-"~14 min" code, so it may read "~12 min"), tick Phase 12, then `mpi-end-session` (ask about `.claude/rules/` for the
new `bench:*` events and the `mpi_agent_bench` key).

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

- **Phases 9 + 10 code (2026-09-27, session 575c1f1a), uncommitted until handoff/close:** `_inflightLine()`
  + the tool-field fold + the retry-rank header line (`services/agentLoop.mjs`); skin/edit NOTES
  (`modelPriority.js`); `_modelTakesImage` (`MpiGroupHistoryBlock.js`); `docs/agent-chat.md`. Tests in
  `agent-loop.test.cjs`, `model-priority.test.cjs`, new `tests/desktop/history-prompt-model.spec.js`.
  `routes/connector.js`, `agentToolOps.js`, `agentDispatch.js` needed no change. Live check is Fabio's.
- **Phase 5 code (2026-09-27, session 2f2883e4), uncommitted until handoff/close:** `_gpuJobs`, `_gpuWaitLine`,
  `_waitForGpu`, `_gpuDrained`, `_releaseLlm`, `batch.billed`, the yield after a round and the turn-start wait
  (`services/agentLoop.mjs`); `engineIsLocal()` (`services/agentTools.mjs`); `docs/agent-chat.md` row. Tests: `(m)`
  in `agent-loop.test.cjs` (6). No `routes/llm.js` edit: `releaseOwnModels` is reused as is.
- **Phase 8 code (2026-09-27, session 2f2883e4), uncommitted until handoff/close:** `_look` (`services/agentLoop.mjs`),
  `costUsd` on `/llm/describe` (`routes/llm.js`) and `_describeImage` (`js/shell/agentDispatch.js`), "Agent" in
  `_setSpend` (`MpiAgentChat.js`), `js/events.js` doc line. Test in the MPI-855 spend block.
- **Phase 7 code (2026-09-28, session 2f2883e4), uncommitted until handoff/close:** Options rule + `_takeOptions`
  (`services/agentLoop.mjs`), `_appendOptions` / `_optionBtns` (`MpiAgentChat.js` + `.css`), `docs/agent-chat.md`.
  Tests: `Options:` in `agent-loop.test.cjs` (Route's limit assertion moved there), desktop `options:` in `agent-chat.spec.js`.
- **Phase 7 fix + Phase 13 (2026-09-28, session 7fe5b9b0), uncommitted until handoff/close:** Options rule reworded
  (165 -> 161 bytes, system prompt 10,084) and the four decline results in `services/agentLoop.mjs`; `lastRefused` +
  `REPEATED_CALL` in the tool loop; `agent-test.mjs` cases `options-after-decline` + `options-ideas`, and `options` per
  turn; `agent-loop.test.cjs` (Options wording, install + spend decline markers, the repeat test); `docs/agent-chat.md`.

## Plan Drift

- 2026-09-27 (session 2f2883e4): Phase 5's "check first" answered: the agent turn does NOT block on its generation,
  so the waiting message is part of the fix, not optional. Footprint grew by `services/agentTools.mjs`
  (`engineIsLocal`); `routes/llm.js` and the agent routes needed no edit.

- 2026-09-27 (session 575c1f1a): Phase 9's Chroma item was corrected by Fabio mid-build after a live Krea
  test. Krea2 gives the better skin at low denoise; Chroma's advantage is that its denoise moves the
  character less. Notes only, no rank change, and the "ask Fabio before ranking Chroma first" gate is gone.

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
- 2026-09-27 (5b8e4d8c): Phase 3 grew a `downscale` tool (megapixel target, Fabio). The `docs/agent-chat.md`
  `generate` row now names all four tools. Phase 6 is NOT agentLoop-free as written: the "Test tool
  use" probe is `AgentLoop.probe()`, so its `contextWindow` field is two lines there. The batch kept
  ownership disjoint by leaving that edit to the orchestrator, after the Phase 4 worker finishes.
- 2026-09-28 (session 7fe5b9b0): Phase 13 narrowed from "any identical call this turn" to "a REFUSED call resent
  unchanged with nothing run in between". The literal version breaks the gates that tell the model to resend the SAME
  call (NO_PROJECT -> create_project -> the same generate; GUIDE_NOT_READ -> read -> resend) and two identical
  generates meant as variations. It still stops gemma4:12b's 15 back-to-back write_memory resends.
- 2026-09-28 (session 7fe5b9b0): Phase 7's fix needed more than the rule. Reworded as a trigger ("a reply that offers
  choices (models, ideas, routes, yes or no) ends with [options: A | B]") the ideas fork went 0/3 -> 3/3, but the
  declined-install fork stayed 1/3: the tool result said "ask what they would like instead" and the model did, in
  plain text. The four decline results (install, spend x2, batch) now say "ending on [options: A | B]": 3/3.
- 2026-09-28 (session 4143bc2a): Phase 12b's progress rides the EXISTING `/agent/stream` (bridged to the bus by
  `agentService`), not a POST response streaming SSE: no second reader in the renderer, and a Settings panel shut and reopened
  mid-run picks the run up (`GET /agent/benchmark`'s `running` + the next `bench:case`). `bench:start` dropped: the POST
  reply carries `cases`, the GET the estimate. Cost is the loop's own `spend.chatUsd` (12a's decision), not `fetchDeepInfraPrices`;
  the live price is read only for the ESTIMATE (55K + 1.5K tokens a case). A probe runs first so a bad key never scores 0.
  The result is saved by `agentService`, not Settings (the panel may be shut when the run ends). Footprint grew by
  `js/services/agentService.js`, `js/core/storageKeys.js`, `js/events.js` (doc lines) and `services/agentLoop.mjs`
  (`onLocalGpu` export, used by the loop's own check too).

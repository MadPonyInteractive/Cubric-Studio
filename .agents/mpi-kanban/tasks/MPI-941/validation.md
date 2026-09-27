# MPI-941 validation

## Phase 1 - big batch is one job

**Automated (2026-09-27, session a8643a90):**
- Red first: `node --test --test-name-pattern="ONE job|with failures" tests/agent-loop.test.cjs`
  failed twice. Fifty cards took 50390 ms to queue, and the ledger held no `cards` list (the items
  collided on one entry).
- Green, same command: 2 of 2 pass. Fifty cards took 2.5 s end to end with a 1.5 s render each,
  so queueing was about 1 s (one refusal race). The checks: one `batch` progress-line id, final
  label `upscale with test-model: 50 of 50 done`, 0 `agent:result`, 1 `agent:drained`, 1 note
  starting `[Batch finished: ... 50 landed.`, 0 looks, and history holding the same one line.
- Failures test: the note reads `3 landed, 2 failed: OOM: out of memory (card_2, card_4)`, and
  the ledger keeps one entry with `cards` = those two and `status: OOM`.
- `node --test tests/agent-loop.test.cjs tests/agent-sessions.test.cjs tests/mcp.test.cjs tests/agent-prompt-budget.test.cjs`:
  176 pass, 0 fail.
- `npm test`: 1998 tests, 1997 pass, 0 fail, 1 skipped.

**Live, first try (Fabio, 2026-09-27):** 8 dot-marked cards, agent picked Krea 2 upscale. After
Yes the first card was refused GUIDE_NOT_READ and the confirm card came back. The guide gate ran
after the ask. Fixed (Plan Drift). The new test was red, then green. Agent files: 177 pass, 0 fail.

**Live, second try (Fabio, 2026-09-27, after restart):** all 8 upscaled fine, each landing as a
new version on its own card. But Phase 1 did NOT engage. Krea 2 upscale wants a prompt per
picture, so the agent looked at 8 cards, sent 8 separate generates, got 8 chat bubbles, and
auto-looked at 8 results: 16 describer calls (`app.log` [agent] `look FRESH`, 00:15-00:22).
No `cards` call means no batch. That is not a Phase 1 defect. The agent had no prompt-free
upscale to batch, which is why MPI-904 moved up to Phase 3. The real Phase 1 live check is
Phase 3's: a plain upscale over dot-marked cards.

**Live (Fabio): pending (see above).** On a real multi-select, ask for "upscale all of these". Expect one
chat line counting up, no per-image result cards, and one short report at the end.

## Phase 2 - MPI-948: a dragged selection is ONE set (session c0103e59, 2026-09-27)

**Red first:** three new tests failed for the right reason before any code. `(l) a dropped set of fifty
cards is ONE attachment line...` (tests/agent-loop.test.cjs): "fifty cards, one line" 0 !== 1.
`the route takes a set...` and `a drag payload carrying the selection becomes ONE set reference...`
(tests/agent-card-reference.test.cjs): no set branch, and `count` undefined.
**Green:** all three pass. Full `npm test`: 2008 tests, 2007 pass, 0 fail, 1 skipped. Lint clean on the
six touched source files.
**Desktop:** new `tests/desktop/agent-drag-set.spec.js` passes (grid dragstart carries the selection in
click order, an unselected card drags alone, the real panel draws ONE "3 cards" chip, and the POST
carries ONE set of 3 in click order). It was written after the code, so it was proven to bite: with
`_dragCards` neutered it FAILED (`Cannot read properties of undefined (reading 'map')`), and passed again
once restored. Regression: `agent-chat.spec.js` 33/33, and `gallery-drop-overlay-reset`,
`media-picker-cards`, `gallery-cue-all` 7/7.
**Live, first try (Fabio, 2026-09-27): WORKS.** He dropped 3 cards and asked "Make new black-and-white versions of
these". The agent read Klein 9B's guide and ran KleinEdit over the set: ONE progress line, "0 of 3
done" then "3 of 3 done", no result card per image, no looks, and one wake sentence. That is also
Phase 1's batch path, live for the first time, although it was not the 350-card scale. Found:
(1) the set chip in the SENT bubble was nearly invisible, a fixed light ink on the cream bubble.
It now inherits the bubble's ink, and the number leads the chip. Found while fixing it: ONE set
chip grew a scrollbar in the composer, because the field's `flex: 1 1 auto` shared overflow with
the strip. It is now `1 1 0`; the spec asserts the strip does not scroll, and it was proven red
on the old value. `agent-chat.spec.js` + the set spec: 34/34.
(2) He asked for NEW cards on purpose. Each edit landed in its own card's history, while the agent
told him "they'll land as new cards". No new-card switch exists, and Fabio agreed to drop the idea
rather than grow the full tool schema. The set line now says "An edit of each lands as that
card's next version, never a new card", so the agent stops promising otherwise (unit test
asserts it). Full `npm test`: 2008 pass, 0 fail.
**VERIFIED by Fabio (2026-09-27): "1".** He also approved the rules update: `.claude/rules/component-events-blocks.md`
(the grid's dragstart payload, and `cards`) and `component-events-primitives.md` (the chat's drop, the set chip,
and the `batch` tool line). **Phase 1 is closed on the same run**: its batch path ran live (one line,
no result cards, no looks, one wake sentence), 3 cards rather than 350. The confirm above 5 and the
fifty-card timing are unit-proven.

**Original live-check brief:** Select 3+ cards, drag one of the SELECTED cards onto the agent panel. Expect one chip,
"N cards" with a layers icon, not N thumbnails. Then say "make these black and white" (one shared prompt,
so no look per card): one confirm above 5, one progress line, one report. "Upscale these" still picks
Krea 2 and looks at every card until Phase 3 ships a plain upscale.

## Phase 3 - MPI-904: plain upscale, background removal, crop with no model (session cefc4ae6, 2026-09-27)

**Built.** The agent's `generate` runs a TOOL when it names no `modelId` and no `flowId`:
`imageUpscale` (fields upscaler `4x-NMKD-Siax` | `4x-AnimeSharp`, factor 1.5/2/3/4), `removeBackground`
(fields background `#rrggbb`, else transparent) and `crop` (fields ratio + position, via the `resize` op
in its crop mode). Defined once in `js/shell/agentToolOps.js`; listed as `tools` by `list_models`,
whole by `describe_model <op>`. Each runs the History rail's universal op with the rail's params and
lands as the source card's next entry. No tool-schema or system-prompt byte changed.
**Unit:** `tests/agent-tool-ops.test.cjs` 6/6 (fields -> params, crop maths, refusals by name);
`tests/agent-generation-relay.test.cjs` + the tool case (operation-only reaches the renderer; a
non-tool op and a named param on a tool are 400s); `tests/agent-loop.test.cjs` two cases, red first
(BATCH_UNSUPPORTED): fifty cards over `imageUpscale` are ONE batch with no guide read, no look, no
prompt, fields on every item and no `follow`, and the confirm names "imageUpscale"; the catalogue
lists the tools and one tool call gets no auto-look. Full `npm test`: 2017 pass, 0 fail (budget
tests unchanged).
**Desktop:** new `tests/desktop/agent-tool-ops.spec.js` passes: a real POST through the route, the
job stream and `_submitTool` (the crop decodes the picture, then refuses a bad ratio; no picture is
MEDIA_REQUIRED), then two tool jobs sit in the Cue queue as `imageUpscale` (Upscale_Factor 3,
4x-AnimeSharp.pth, model.id null) and `resize` crop at the picture's short side, both scoped
`groupHistory` to the source card. Every non-connector fetch hangs first, so nothing reached the
shared engine.

**Live check brief (Fabio):** mark 10+ cards with the dot and ask "upscale every card marked with a
dot" (or drag a set of them and say "upscale these"). Expect: no guide read, no looks, no prompts;
one confirm card above 5; ONE progress line "imageUpscale: n of N done"; each result as the NEXT
entry of its own card; the view stays where you are. Then try "remove the background of this one"
and "crop this to square". Watch-for: the agent reaching for an edit model on "remove the
background" (the Model rule names backgrounds under edit); if it does, that rule is reworded at no
net byte cost.

**Live try 1 (Fabio, 2026-09-27 ~08:56): FAILED, the tool was never chosen.** "Upscale every card
marked with a dot" went to Krea 2 again: read its settings, GUIDE_NOT_READ, read guide:krea-2, then
"Run this 6 times? upscale with krea2". Two causes, both fixed, red first:
(1) `GET /connector/models` rebuilt its reply as `{ engine, hardware, models, flows }` and DROPPED
the renderer's `tools`, so the agent never saw one. The unit tests stubbed `listModels` below the
route and the desktop spec never called it. New relay test: the route carries `tools`.
(2) Even listed, Krea 2's `upscale` carried `best: true` for the task and the system prompt's Model
rule says best is the op to take. `modelPriority.js` now ranks the tool (`['', 'imageUpscale']`)
first for `upscale`, Krea 2 is rank 2 with a note ("re-renders ... only when the user asks for more
or new detail; a plain enlargement is the imageUpscale tool"), and `compactCatalogue` lets tools
compete for `best`. Tests: `model-priority` + `(l)` best case. Full `npm test`: 2020 pass, 0 fail.

**Live try 2 (Fabio, 2026-09-27 ~09:39): WORKS.** "Upscale all the images with a dot": no guide, no look, no
prompt; "Run this 6 times? imageUpscale", ONE line to "6 of 6 done", each result the next entry of its own
card (t2i_039 -> imageUpscale_001, 1152x928 -> 2304x1856). Sidecar: Upscale_Model 4x_NMKD-Siax_200k.pth, factor 2
(the History rail showing "None" is its own saved dropdown, not the run). Fabio: Siax as default is fine,
as long as the user can ask for another method (AnimeSharp is in the tool note). Two findings, fixed, red
first: (1) Lingo stood in "writing the prompt" for a run with no prompt: a tool `generate` now emits
`noPrompt` and the chat sends no guest (agent-chat.spec crew case); (2) the agent said "new cards": a tool
result on a card and its batch note now say it lands as the card's next version. npm test 2037 pass, 0 fail;
agent-chat.spec 34/34 (one composer test flaked once, passed alone). NOT yet live-checked: those two fixes,
removeBackground and crop.

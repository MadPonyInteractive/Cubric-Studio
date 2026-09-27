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

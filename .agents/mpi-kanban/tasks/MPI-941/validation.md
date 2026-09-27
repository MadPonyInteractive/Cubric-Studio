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

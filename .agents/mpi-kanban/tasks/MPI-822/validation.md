# MPI-822 Validation

## FIRST APP PASS, 2026-09-19 - FAILED. Read this before the green table below.

Fabio ran it. Two faults, one of them mine and serious:

1. **ReferenceError on the whole run path.** `_setRunning(isRunning)` became
   `_syncRunning()` and ONE use of the old parameter was left behind:
   `Uncaught (in promise) ReferenceError: isRunning is not defined at _syncRunning
   (MpiBaseFlow.js:3220:26) at _run (:3484:13)`. Cue threw and nothing dispatched.
   **FIXED** (`_setScanline(_running)`).

   WHY EVERY CHECK BELOW MISSED IT, because this is the reusable lesson: the new
   tests are source-contract REGEXES - they read the file, they never execute it, so
   a ReferenceError is invisible to them. And `npm run lint` cannot help either:
   **`eslint.config.js` does not enable `no-undef`.** Proven after the fact - with
   the bug re-introduced in a scratch copy, an ad-hoc `no-undef` config reports
   `3224:26 error 'isRunning' is not defined`. Re-run over every file this card
   touched: clean, so this was the only one. Turning the rule on repo-wide is out of
   scope here and has been raised separately.

2. **Stop was `size: sm` beside a `size: md` Cue** and read as misaligned.
   **FIXED** - both `md` now. Deliberately NOT the PromptBox's `sm`: that bar
   stacks Stop and Clear beside its own Cue, this column is one row.

3. **Q does not open the queue slide-over from inside a flow - STILL OPEN, NOT
   FIXED.** This is MPI-822 scope (brief.md ' Verify at implementation'). See
   plan.md ' The Q bug for the investigation and the live check that comes next.

The table below is therefore the state AFTER fixes 1 and 2, with 3 outstanding.


**Verify mode:** user-ux — the card is a button, its copy and a layout. Automated
checks can prove the wiring; they cannot tell Fabio it feels right.

## Automated — RUN AND PASSING, 2026-09-19

| Check | Command | Result |
|---|---|---|
| Full unit suite | `npm test` | **1444 pass, 0 fail, 1 skipped** (1445 tests) |
| Repo lint | `npm run lint` (`eslint js/ --max-warnings=0`) | **clean** |
| MPI-822 contracts | `node --test tests/flow-cue-stacks.test.cjs` | **6/6 pass** |

## The new test was proven RED on pre-fix code

A contract that only passes after the change proves nothing about whether it would
have caught the bug. All 14 of its assertions were run against HEAD's blobs
(`git show HEAD:<path>`) and **14/14 fail there** — the single-slot guard, the
Generate↔Cancel morph, the absent `_runs` set, the `_myTempId` slot, the dispatch
wipe, the blanket `_showResults([])`, the Cue label, the queue-count listener, the
Stop button, its hotkey, and the PromptBox bail.

## NOT proven here, stated rather than skipped

No generation was executed. Nothing below has been observed:

- three presses actually producing three cards,
- Stop ending only the running job while the pending ones survive,
- the queue slide-over opening above the flow overlay and stopping a pending job,
- the Cue/Stop row's layout at the flow frame's 236px control column.

## What Fabio checks in the app

1. Open any flow, press **Cue** three times. The button reads `Cue`, `Cue x2`,
   `Cue x3` — and the frame never blocks.
2. The previous result **stays on screen** while the new runs go (latest-wins), and
   "Saved to your gallery" stays with it.
3. **Stop** ends the running job only; the queued ones keep going.
4. Press **Q** from inside the flow — the queue slide-over opens above the overlay,
   and its per-row stop kills a pending job.
5. **Ctrl+Alt+Enter** inside a flow stops the flow's job and does NOT also stop a
   gallery job running behind it.

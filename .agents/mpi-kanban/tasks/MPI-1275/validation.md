# MPI-1275 validation

## Cause (2026-10-24)

The product's queue path is not slow. On both failing runs (40099293204, 40021715674) the
sibling test "no auto-look on batch items: fifty cards" pushed 50 cards through the same
`_fanOut` -> `generate` path in 34 ms. Locally the failing test measured ~1020 ms every run,
and so did passing CI runs.

The test timed a span containing a REAL 1000 ms refusal-window timer (the first card's race
in `generate`, `EARLY_REFUSAL_MS`) and allowed 600 ms on top. GitHub runners stalled
0.7-0.9 s once in a while; on 40099293204 heavy 16K sharp/ffmpeg tests in parallel files
ran 30-50% slower than on the passing run before it. A one-off stall inside that window
read as "the 49 other cards waited".

## Fix

`tests/agent-loop.test.cjs` 'fifty cards are ONE job': counts `setTimeout` calls of 1000 ms
during the batch and asserts exactly one, the claim under test ("validate once"), instead of
timing wall clock. No product change. Commit 4142cf4a0.

## Checks

- Test alone: pass. Provoked regression (every card races the window, temporary local edit
  to `opts.batch?.validated`, reverted): fails, 50 windows, 50 s.
- `npm test`: 3584 pass, 0 fail. `eslint tests/agent-loop.test.cjs`: clean.
- CI on 4142cf4a0: run 40102049571 green (unit + desktop 1-4).

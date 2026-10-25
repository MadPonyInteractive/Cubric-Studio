# MPI-1292 validation

- Code: `aa7a7aca6` (MpiBaseFlow.js `_syncPeek` / `_peekCast`, docs/mascot-placement.md Flows row).
- Lint + unit tests: green on the pre-push gate (3674 tests, 0 failed).
- Framing: every new clip (Lingo, Prism, Reel, Vinyl: peek, idles, greets) played in the peek window in an isolated instance; none shears. Lingo's idle-3 left out (hands reach row 32).
- Eye test: Fabio ran a Flow on 2026-10-25 and said the peeks look good.

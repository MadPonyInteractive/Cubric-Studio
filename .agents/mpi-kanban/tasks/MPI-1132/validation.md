# MPI-1132 validation

2026-10-13 - passed.
- `node --test tests/agent-bench.test.cjs` -> pass 17, fail 0 (two new MPI-1132 tests).
- Bite: renamed the `visibleCards` fake -> the unguarded-tools test failed naming `visibleCards`; restored.
- `node --test tests/agent-loop.test.cjs tests/bench-community.test.cjs` -> pass 202, fail 0.
- `npx eslint services/agentBench.mjs tests/agent-bench.test.cjs` -> clean.

Added fakes: discardAttachments, listCards, visibleCards, markCard, makeGif, editGif, cutoutGif,
gifToVideo, makeSheet, quoteGeneration, cancelGeneration, readGlobalMemory, writeGlobalMemory,
openFlow, openPrompt, installFlow. The project lists only the card a fake generate lands.
No live-model run: the card asks for the fakes and the guard test, not a re-run of the room case.

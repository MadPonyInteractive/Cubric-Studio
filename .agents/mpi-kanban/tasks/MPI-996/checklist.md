# MPI-996 checklist

Fabio 2026-09-30: the in-app agent answered "Can you access the internet?" with yes, it can search
and browse. It has no web tool. Build nothing; make the answer honest.

- [ ] One honest-limits line in `_buildSystemPrompt` (`services/agentLoop.mjs`): no search, no browsing, no made-up links
- [ ] `SYSTEM_BUDGET` raised by the measured bytes, noted in its comment (`tests/agent-prompt-budget.test.cjs`)
- [ ] Finding recorded in `docs/agent-findings.md` (stays at 200 lines)
- [ ] `node --test tests/agent-prompt-budget.test.cjs tests/agent-loop.test.cjs` green
- [ ] Committed by pathspec, pushed, CI green

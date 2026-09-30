# MPI-996 checklist

Fabio 2026-09-30: the in-app agent answered "Can you access the internet?" with yes, it can search
and browse. It has no web tool. Build nothing; make the answer honest.

- [x] One honest-limits line in `_buildSystemPrompt` (`services/agentLoop.mjs`): no search, no browsing, no made-up links
- [x] `SYSTEM_BUDGET` 10,150 -> 10,250, measured 10,202, noted in its comment (`tests/agent-prompt-budget.test.cjs`)
- [x] Finding recorded in `docs/agent-findings.md` (200 lines)
- [x] `node --test tests/agent-prompt-budget.test.cjs tests/agent-loop.test.cjs`: 155 pass, 0 fail, 1 skipped
- [x] Committed `bc027bb8a` (private index: HEAD + my lines only)
- [x] Pushed: first held by pre-push (master red since `773e4b9cf`, MPI-995), then went out under MPI-995's fix `4b4b8960b`
- [x] CI green on a push carrying `bc027bb8a` (`tests.yml` on `4b4b8960b`)

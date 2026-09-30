# MPI-996 validation

**Shipped:** `bc027bb8a` - one honest-limits line in `_buildSystemPrompt` (`services/agentLoop.mjs`):
"I cannot search or browse the internet, and I never make up a link." Nothing built: no web tool.

**Evidence**
- `node --test tests/agent-prompt-budget.test.cjs tests/agent-loop.test.cjs`: 155 pass, 0 fail, 1 skipped.
- System prompt measured 10,202 bytes; `SYSTEM_BUDGET` 10,150 -> 10,250.
- Push was held by the red master from `773e4b9cf` (MPI-995, 90% UI zoom on desktop specs; not this
  card's). MPI-995 fixed it in `4b4b8960b`; `bc027bb8a` went out under it, and the `tests.yml` run on
  `4b4b8960b` is green.
- Close-out doc heal: `docs/agent-chat.md` budget line (said 10,150 and "1 byte to spare").

**Decided, not built (Fabio 2026-09-30):** no web search or fetch for the agent (prompt injection
via page text, a new provider, the privacy page). An allowlisted route returning structured rows from
chosen sites was discussed and parked by Fabio; he will raise it if needed.

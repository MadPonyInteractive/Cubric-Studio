# MPI-1009 Brief

Outside agents (Claude, Codex, Antigravity over MCP) get routines: list, save, rename, delete and
run, the same as Cosmo.

## Why

Fabio, 2026-10-01: "why are MCP agents not able to use routines? Shouldn't they be able to?"
MPI-970 deferred it on purpose: its plan D8, "MCP exposure is a separate future card; do not grow
this one". No card was made until now.

## What is true today (read 2026-10-01, Agent 81)

- The HTTP half exists: `routes/connector.js` ~:1147, `GET/POST /connector/routines`,
  `GET /connector/routines/:name`, `POST /connector/routines/:name/quote` and `/run`. A run is
  held until every card's chain ends.
- The MCP server (`routes/mcp.js`, `TOOLS` at ~:269) has 17 tools and no `routine` tool; its
  `INSTRUCTIONS` never mention routines.
- Cosmo's `routine` tool and its rules: `services/agentLoop.mjs`, `docs/agent/routines.md`,
  `docs/agent-chat.md` ~:87.

## Shape to settle in the plan

- One `routine` MCP tool mirroring Cosmo's (`action: list|save|run|rename|delete`), or a few
  narrow tools. Match how `generate` is exposed.
- Money: a run over paid steps must answer `CONFIRM_COST` with the quote's price and run nothing
  until resent with `confirmCost`, like `generate`. Never confirm for the user.
- Long runs: a held run outlives an MCP client's clock (the client's 60 s timeout is not ours to
  trust); answer `{ running: true, jobId }` and finish through `wait_generation`, as video does.
- Run inputs (MPI-970 D9) and `folderPath` (where the new cards land) need MCP fields.
- The outside-agent knowledge (`cubric-studio` plugin skill / MCP instructions) gains a routines
  line, so a client knows they exist.

## Do not

- No paid run while testing without Fabio's yes, price and run count first.

## Noticed

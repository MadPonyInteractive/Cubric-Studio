# MPI-1127 - Cosmo installs Flows behind its Yes card

## Approach
Widen Cosmo's `install_model` to take a Flow id (one tool, shortest prompt). A Flow id asks
`agentTools.installFlow(id, false)` for size + licence, shows the same `kind: 'install'` Yes / No
card (plus a licence-screen line), and on Yes calls `installFlow(id, true)`. NO_ENGINE (Flow
pre-check, or a model after Yes) is reworded for Cosmo: Settings > Remote or the app's own engine
install, never install_engine (Cosmo has none).

## Verification
**Verify mode:** auto
- `node --test tests/agent-loop.test.cjs` (Flow install: card, Yes starts it, No does not, NO_ENGINE wording)
- Guide: Song is free; only Head Swap and DramaBox are paid

## Current State
Code + docs + tests done and verified 2026-10-13 (validation.md). Uncommitted. Next: close-out
(commit by pathspec from files.json, push, CI green, card done).

## Completed
- agentLoop: install_model takes a Flow id (installFlow size first, Yes -> start), `cosmoNoEngine`
  rewords NO_ENGINE for both Flow and model; snapshot carries `licence`; tool text trimmed to budget
- MpiAgentChat card: "A licence screen opens first." after the size
- Guide flows.md (Song free, only Head Swap / DramaBox paid), routines.md, agent-chat.md, mcp-server.md,
  add-flow 07, UNRELEASED.md

## Plan Drift
- 2026-10-13: tests/desktop/agent-chat.spec.js added (card text check) and docs/agent/routines.md.
- Tool schemas were exactly AT TOOLS_BUDGET before this card; now ~10 bytes under. Any new tool text needs a trim.

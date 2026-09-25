# MPI-593 Checklist

- [x] Step 1: split the cubric-vision skill *(2026-09-15, `validation.md`)*
- [x] ~~CLI~~: dropped 2026-09-25, MCP-first (`brief.md`)
- [x] Phase 1: MCP spike *(2026-09-25, `validation.md`)*
  - [x] `POST /mcp`, 8 tools over `agentTools.mjs`, `tests/mcp.test.cjs` 10/10
  - [x] `.mcpb` bridge, `mcpb validate` passes, packs to 2.1 kB
  - [x] Bridge drives the real app: project created, image lands on disk
  - [x] Cold Claude Code agent makes an image unaided, exactly one file
  - [x] Fabio: `.mcpb` in Claude Desktop against his own app *(2026-09-25, one card)*
  - [x] Codex in VS Code *(2026-09-25, one card, slow start: see validation.md)*
- [x] Brief questions answered *(2026-09-25: price first, write a privacy policy, one public repo)*
- [ ] Phase 2: safe for users (`plan.md`)
  - [x] 1. Cost check: `CONFIRM_COST` until the price is repeated *(live: Veo refused at about $3.20)*
  - [ ] 2-7. Reference images, usable results, tool set, app-closed, titles, cold tests
- [ ] Privacy policy on cubric.studio (Website repo, Fabio publishes)
- [ ] Phase 3: ship and list (`plan.md`)

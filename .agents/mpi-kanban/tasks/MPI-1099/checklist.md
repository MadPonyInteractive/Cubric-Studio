# MPI-1099 checklist

Fabio, 2026-10-11: Cosmo must be able to make a sheet from several pictures (MPI-1094's
gallery Combine), or at least tell the user how.

- [x] `/combine-images`: no `tree` = the server packs (`sheetLayout.packSheet`, real aspects),
      centre framing; shape defaults Auto, size 2K.
- [x] `sheet.make` renderer job (gifJobs.js) lands the card; `POST /connector/sheet/make`.
- [x] Cosmo `make_sheet` (agentTools + agentLoop) and MCP `make_sheet` (mcp.js + manifest).
- [x] Tests: auto-pack render, agent tool, MCP tool list.
- [x] Docs: agent-chat.md, mcp-server.md, gallery-selection.md.

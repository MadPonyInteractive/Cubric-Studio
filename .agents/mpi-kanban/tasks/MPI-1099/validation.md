# MPI-1099 validation

Shipped in `86e917c6c`.

- Cosmo `make_sheet` (`services/agentLoop.mjs` + `agentTools.makeSheet`) and MCP `make_sheet`
  (`routes/mcp.js`, `mcp/cubric-studio/manifest.json`) -> `POST /connector/sheet/make` ->
  renderer `sheet.make` (`js/shell/gifJobs.js`) -> `/combine-images` with no tree, which
  packs server-side with `sheetLayout.packSheet` and centres every picture.
- Tests: `npm test` 3137 pass / 0 fail. New: agent ref -> item id + card in `_groups`
  (`agent-cards`), auto-pack render (`image-sheet`), MCP tool list, no-delete allowlist,
  capability map. Tool-schema budget raised by the measured +563 bytes, reason in the test.
- Live, own `app:isolated`: three picture cards, `POST /connector/sheet/make` 8:5 4096 ->
  `sheet_001.png` 4096 x 2560 landed as a 4th gallery card and persisted to project.json;
  a one-card call answers BAD_REQUEST.
- Not run: a real Cosmo turn with an LLM choosing the tool (needs a model + key); the tool
  path under it is the unit-tested one.

# MPI-1136 validation

## What shipped

- One import path: the gallery's own Add to project route (`POST /project-media/:id/add-from-cards`).
  It now also answers `groups` (the new cards, hydrated), so a caller whose target is the OPEN
  project can `addGroup` them instead of being overwritten by the renderer's next save.
- `POST /connector/import-card { sourceFolderPath, groupId, folderPath?, cardName? }` -> renderer
  job `card.import` (`agentDispatch._importCard`). Open target: the drop's spinner card + `addGroup`.
- MCP `import_card` (routes/mcp.js, 28 tools; manifest 0.3.2 lists it) and Cosmo `import_card`
  (agentLoop, always into the open project) both call `agentTools.importCard`.
- Cosmo's `list_cards` takes `folderPath` for ANOTHER project (only a listed or typed one), rows
  without refs, nothing registered: a card there is reachable only by importing it.
- Cosmo tool-schema budget raised 15,333 -> 16,030 (+707) in tests/agent-prompt-budget.test.cjs.

## Evidence

- `npm test` green (see commit).
- New: tests/import-card.test.cjs (Cosmo), tests/mcp.test.cjs `import_card` case.
- Live, 2026-10-16, own `app:isolated` (scratch profile + APP_DOCUMENTS, port 57973) over MCP:
  created "MPI-1136 Episode 1" and "Episode 2" (2 open), import_media a picture into 1 as "Mira",
  import_card 1 -> 2 (OPEN target): copy landed, list_cards and project.json agree; rename_card on
  the copy then found it in the renderer's state and the save kept it. import_card 2 -> 1 (CLOSED
  target) with cardName "Mira copy back": landed with the new name. A made-up groupId: NO_SUCH_CARD.
  Source file untouched.
- NOT verified live: Cosmo (the scratch profile has no LLM key). Covered by the unit test only.

## Eye test for Fabio

1. Two projects, open the second. Ask Cosmo: "bring Mira in from <first project>". It should list
   that project's cards, import the right one, and the copy appears in the open gallery with its name.
2. From Claude Desktop / Claude Code (MCP): `import_card` with `sourceFolderPath`, `groupId` from
   `list_cards`, and a `folderPath` that is NOT open. The copy appears when that project is opened.

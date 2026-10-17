# MPI-1136 checklist

- [x] One copy path: the gallery's `add-from-cards` route, reached by renderer job `card.import` so an OPEN target gets `addGroup` and is not clobbered
- [x] `POST /connector/send-cards` { sourceFolderPath, groupIds? | kind?, mark?, newest?, folderPath? | newProject? }
- [x] `send_cards` on MCP (routes/mcp.js) and Cosmo (agentLoop) both call `agentTools.sendCards`; pick by hand, kind, mark, newest; newProject opens after
- [x] Tool counts / docs / manifest / UNRELEASED.md updated
- [x] npm test green; live MCP check on an isolated app
- [x] Eye test by Fabio: Cosmo half 2026-10-17, MCP half 2026-10-17

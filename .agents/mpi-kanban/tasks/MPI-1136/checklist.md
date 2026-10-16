# MPI-1136 checklist

- [ ] One import path: the gallery's `add-from-cards` route, reached by a renderer job (`card.import`) so an OPEN target gets `addGroup` and is not clobbered
- [ ] `POST /connector/import-card` { sourceFolderPath, groupId, folderPath?, cardName? }
- [ ] MCP `import_card` tool (routes/mcp.js) + Cosmo `import_card` tool (agentLoop) both call `agentTools.importCard`
- [ ] Tool counts / docs / manifest / UNRELEASED.md updated
- [ ] npm test green; live: MCP import A -> B on an isolated app; Cosmo if drivable
- [ ] Eye test by Fabio

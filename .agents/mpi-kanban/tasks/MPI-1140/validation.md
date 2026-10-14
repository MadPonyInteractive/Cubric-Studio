# MPI-1140 validation

- `node --test` on the 39 files touching the changed modules: 634 tests, 633 pass, 0 fail (incl. new `tests/mcp.test.cjs` import_media case: route reached with the named project, disk path + picture back, FILE_NOT_FOUND / PROJECT_NOT_FOUND refuse before any route).
- eslint clean on every changed JS file.
- Live, isolated instance (`scripts/launch-instance.mjs`, own profile + port, 2026-10-14): over `/mcp`, a PNG imported into the OPEN project landed as a card named "Test photo" (640x360, thumb returned); an MP4 imported into a CLOSED project by folderPath landed as `imported_002` (video, 2 s); a `.mjs` answered UNSUPPORTED_FILE. Re-opening the closed project kept both cards in `project.json` and `list_cards`.
- Not done: the Claude Desktop `.mcpb` bundle (manifest 0.3.2) is not re-released; the bridge lists tools from the app, so the tool works without it. Release at the next app cut.

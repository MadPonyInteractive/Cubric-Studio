# MPI-873 Checklist

Plan: `.agents/mpi-kanban/tasks/MPI-593/plan.md` § Phase 4 (this card is folded there).
Decision (Fabio, 2026-09-26): the named project may be CLOSED; the run lands in it through
`updateProjectJson()` and the user's view never moves.

- [x] `routes/mcp.js`: `generate` + `list_cards` take optional `folderPath`; reference media staged into THAT project (GIF tools OUT: they work on the open project's items, see MPI-593 plan drift)
- [x] `routes/connector.js`: `/connector/generate` matches `folderPath` against `/list-projects` (`findProjectByFolder`) and dispatches the LIST's spelling; `PROJECT_NOT_FOUND` / `INVALID_FOLDER_PATH`
- [x] `js/shell/agentDispatch.js`: `targetProject` (live open object, or closed read over `/get-project`), `config._originProject`, mask/history/follow only when open, `nameCard` names a closed card via `/project-groups`; `flowService` run-only `runOriginProject`. Quote unchanged (pinned settings are the open panel's, by design)
- [x] Tests: `tests/agent-target-project.test.cjs` (8), `tests/mcp.test.cjs` (+1, 24/24), `flow-enhance-ownership` regex extended; full suite 1982 pass / 0 fail; eslint clean
- [x] Skill docs (generate, core SKILL + projects.md, flows) + `docs/mcp-server.md`: `folderPath` documented, "whatever project is open" wording gone (GIF skill unchanged, still true)
- [x] Live: open A, submit naming B, switch to C mid-render; card lands in B, A/C untouched; no-project submit still lands in the open one *(2026-09-26, validation.md)*
- [ ] Commit + push (close-out)

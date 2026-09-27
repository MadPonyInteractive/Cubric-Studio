# MPI-947 checklist

Research phase (throwaway config dirs only, never Fabio's real agent configs):

- [x] Detection: how the app finds each client (CLI on PATH, Claude Desktop install, Antigravity install)
- [x] Claude Code: marketplace add (https) + plugin install in a scratch `CLAUDE_CONFIG_DIR`
- [x] Codex: marketplace add + plugin add in a scratch `CODEX_HOME`
- [x] Antigravity: target path confirmed (embedded docs + Fabio's 09-26 install); fake-home launch SKIPPED (would share `%APPDATA%`, adds nothing)
- [x] Claude Desktop: `.mcpb` file association registered (no open)
- [x] Spawn from Electron: `.CMD` shims, no console window
- [x] Findings written to `research/connect-paths.md`
- [x] Plan written (`plan.md`), `files.json` extended to the product files
- [x] D1 yes, D2 no (Fabio 2026-09-27)
- [x] D3 live Claude Desktop run: install screen appeared (Fabio "yes to all", 2026-09-27)
- [x] Phase 1 server (auto): agent-connect 6/6, mcp + windows-hide 33/33, full suite 2008 tests 0 fail
- [x] Phase 2 Settings section built inline in MpiSettings; isolated-instance UI round trip PASSED
- [x] Phase 2 Fabio checks the section in his own app (user-ux): screenshot after the MSIX fix, then "yes to all"
- [x] In-app "get it" hints under Codex (ChatGPT) and Antigravity (Gemini) when not installed
- [x] Phase 3 docs: docs/mcp-server.md, UNRELEASED.md
- [x] .claude/rules/: no component wiring changed (inline section, no events/state/props), so no map update
- [x] Mac/Linux branches in the route (unit-tested, unrun on real hardware)
- [x] cubric-studio-agents README: cross-platform Claude Desktop step + "the easy way" + Gemini -> Antigravity hint, pushed `b5e04c6` (Fabio's yes)
- [x] `.claude/settings.json` additionalDirectories += ../cubric-studio-agents (Fabio 2026-09-27)
- [x] `.claude/rules/sibling-repos.md`: agents repo + ComfyUi-MpiNodes moved into the additionalDirectories list (Fabio's yes)
- [ ] Commit Vision work, CI green, close MPI-947 (mpi-end-session)

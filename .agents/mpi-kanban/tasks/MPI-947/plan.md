# MPI-947 plan: Settings > Connect an agent

Member of the MPI-593 umbrella (Phase 3 item 2). Target 2.0. Evidence behind every choice:
`research/connect-paths.md` (2026-09-27).

## Goal

A Settings section that connects Claude Desktop, Claude Code, Codex and Antigravity in one
click where the client is installed, shows which are connected, disconnects them, and always
shows the plain MCP URL + instructions for any other agent.

## Current State

**2026-09-27 (session 593c46ac): ALL VERIFIED by Fabio (section + D3), Mac/Linux branches and
Codex/Antigravity "get it" hints added, agents README pushed `b5e04c6`. Only the Vision commit,
its CI run and the close remain (mpi-end-session).** Earlier the same day:
Phases 1-3 BUILT, then waiting on Fabio's eyes (Phase 2 is user-ux) and D3. Phase 2 landed INLINE in `MpiSettings.js` (+ `.mpi-settings__agents` in its
css), NOT as `Organisms/MpiAgentConnect/`: MpiSettings is a Compound and may mount Primitives
only. Live on an isolated instance with scratch `CLAUDE_CONFIG_DIR`/`CODEX_HOME`: status 0.45 s
with real detection, API + UI Connect/Disconnect round trips for Claude Code and Codex PASSED,
the UI caught a `map(_agentPlate)` index-as-note bug (fixed). Docs: `docs/mcp-server.md`
section + Claude Desktop row corrected, `UNRELEASED.md` agent line.
Earlier: research DONE, D1 yes, D2 no. **Phase 1 BUILT** (not committed):
`routes/agentConnect.js` (GET `/agent-connect/status`, POST `/agent-connect/:id/connect|disconnect`),
`routes/mcp.js` records `clientInfo` on initialize (`seenClients()` export), `server.js` mount,
`tests/agent-connect.test.cjs` 6/6 (two mutations caught), `windows-hide-spawn` exempts
`claudeDesktopExe`. D3 (Fabio's live `claude-desktop.exe <mcpb>` run) still open: its result
decides whether the Claude Desktop row's Connect ships. Next: Phase 2, the Settings section.
Gotcha: Node `existsSync` is FALSE for the MSIX alias (stat EACCES on the reparse point); the
route detects with `lstat`.

## Decisions

- Settled (research): one source for every client, the public repo `cubric-studio-agents`
  (`.mcpb` = its `releases/latest/download/cubric-studio.mcpb`; Antigravity files = its
  `plugins/cubric-studio/` on `main`). No build change, no vendored copy to drift.
  `ponytail:` connect needs internet; offline shows the error + the manual steps.
- Settled: Claude Desktop is launched as `claude-desktop.exe <file.mcpb>` (MSIX alias). NOT
  `shell.openPath`: Claude registers no `.mcpb` file type.
- Settled: CLIs spawn with `{ shell: true, windowsHide: true }`, fixed literal args only, never
  `detached`. Status reads `plugin list --json`, NEVER `claude mcp list` (it health-checks `:3000`).
- **D1 YES (Fabio 2026-09-27)**: "Connected: Claude Code, 2 min ago" from the `initialize`
  `clientInfo` (in-memory, since app start) + a Disconnect per client.
- **D2 NO (Fabio 2026-09-27)**: no agent-access on/off switch.
- **D3 (Fabio)**: one live run of `claude-desktop.exe "<path>\cubric-studio.mcpb"` to confirm
  Claude's install preview appears (Cancel is fine). Also: how was extension 0.2.0 installed on
  09-26 (double-click / drag / Settings)? `docs/mcp-server.md:99` says double-click.

## Phase 1: server (auto-verified)

- `routes/agentConnect.js` (new): `GET /agent-connect/status` -> per client `{ detected,
  connected, version, lastSeen }`; `POST /agent-connect/:client/connect` and `/disconnect`.
  Detection: `where claude|codex`; `%LOCALAPPDATA%\Microsoft\WindowsApps\claude-desktop.exe`
  (or `%LOCALAPPDATA%\AnthropicClaude\claude.exe`); `%LOCALAPPDATA%\Programs\antigravity`.
  Claude Desktop connected = its `Claude Extensions` folder holds ours (verify the folder name
  against Fabio's install first).
- `routes/mcp.js`: on `initialize`, record `params.clientInfo` `{ name, version }` + time
  (in-memory map, exported getter) for D1.
- `server.js`: one mount line.
- `tests/agent-connect.test.cjs` (new): command lists per client, `--json` status parsing
  (fixtures from the research runs), Antigravity copy + delete into a temp home, clientInfo record.
  Spawn is stubbed, nothing reaches a real client.
**Verify:** `node --test tests/agent-connect.test.cjs tests/mcp.test.cjs tests/windows-hide-spawn.test.cjs`.

## Phase 2: the Settings section (user-ux)

- `js/components/Organisms/MpiAgentConnect/` (new `.js` + `.css`): one row per client (name,
  status, Connect / Disconnect via `ComponentFactory`), a restart note ("restart Claude Code to
  load it"), then the URL `http://127.0.0.1:3000/mcp` with a copy button and a docs link.
  Undetected client: row shows how to get it, no button.
- `MpiSettings.js`: a `Connect an agent` `<section>` with one slot after External Connections
  (`:264`); mount in `_initFields`, destroy on teardown (pattern: `MpiRemote.js:35-54`).
- `js/shell/preloadStyles.js` (css), `js/components/types.js` (typedef).
**Verify:** isolated app (`npm run app:isolated`), Settings shows four rows with the right
detection on this box; Connect/Disconnect exercised ONLY against scratch `CLAUDE_CONFIG_DIR` /
`CODEX_HOME` / temp home via env on the isolated instance. Fabio then checks the page and, if he
wants, connects his real clients himself.

## Phase 3: docs

- `docs/mcp-server.md`: the page, the client table (Claude Desktop row corrected per D3).
- `docs/releases/UNRELEASED.md`: one line (claimed by session 92e48234: message first).
- `.claude/rules/component-mounts.md`: new mount, ONLY with Fabio's permission (CLAUDE.md rule 5).

## Verification

**Verify mode:** user-ux (Phase 1 auto).

## Plan Drift

- 2026-09-27: brief assumed `shell.openPath(.mcpb)` for Claude Desktop; false (no file type
  registered). Replaced by the `claude-desktop.exe` argv path.
- 2026-09-27: Phase 2's `Organisms/MpiAgentConnect/` (+ preloadStyles, types.js) dropped: MpiSettings
  is a Compound and cannot mount an Organism (nor a Compound, same-tier lint). Built inline from
  the existing plates + MpiButton instead; one `.mpi-settings__agents` css rule.
- 2026-09-27: Fabio asked "is this Mac/Linux compatible?": it was NOT (Windows paths only,
  against the codebase's own darwin/linux branches). Added: `command -v` + extended PATH,
  Claude.app + Application Support + `open -a`, Antigravity by `~/.gemini/antigravity`. Unit-tested
  with `process.platform` stubbed; UNRUN on real Mac/Linux hardware.
- 2026-09-27: `routes/mcp.js` records `clientInfo` in memory only (D1); no docs-site link on the
  page yet (the docs-site page is a separate MPI-593 draft).

## Completed

- Research: `research/connect-paths.md`.

## Remaining Work

- D1-D3 answered; Phases 1-3.

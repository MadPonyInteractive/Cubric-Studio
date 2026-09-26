# MPI-947 — Settings > Connect an agent

Member of the MPI-593 umbrella (Phase 3 item 2). Target: 2.0.

## Fabio's call (2026-09-26)

The 2026-09-25 "install the conventional way" rule was about keeping agent access open to
ANY coding agent, not a ban on automation. So: connect the known clients AUTOMATICALLY where
possible, and keep instructions + the plain MCP address for every other agent. Instructions
and the `.mcpb` download stay on the page either way.

## What the page does (proposal, feasibility unproven per client)

| Client | Automatic path to prove | Fallback on the page |
|---|---|---|
| Claude Desktop | open the release's `.mcpb` with the OS (`shell.openPath`) so Claude Desktop shows its own install prompt | download link |
| Claude Code | run its CLI: `claude plugin marketplace add https://github.com/MadPonyInteractive/cubric-studio-agents.git`, then `claude plugin install cubric-studio@cubric-studio` (https, never `owner/repo`: that clones over SSH) | copy buttons |
| Codex | `codex plugin marketplace add MadPonyInteractive/cubric-studio-agents`, then `codex plugin add cubric-studio@cubric-studio` (a bare `codex mcp add` is NOT enough, `docs/mcp-server.md`) | copy buttons |
| Antigravity | copy the repo's `plugins/cubric-studio/` into `~/.gemini/config/plugins/`, ask for a restart | download + where to put it |
| Any other agent | — | the MCP URL `http://127.0.0.1:3000/mcp` with a copy button, link to docs |

Plus, cheap and useful: **"Connected: Claude Desktop, 2 min ago"** from the `clientInfo` each
client sends on `initialize` (not recorded today), and a **Disconnect/uninstall** per client.
An on/off switch for agent access is a question for Fabio, not assumed.

## Traps already known (read before building)

- Detect each client before offering Connect (CLI on PATH, Claude Desktop install, `~/.gemini`).
- Spawning `claude`/`codex` from Electron: npm `.CMD` shims need a shell, an `&` splits the
  argument, and `detached: true` pops a console (`~/.claude/memory/tools/windows-shell-traps.md`,
  `windows-console-windows.md`).
- Test installs in a throwaway `CLAUDE_CONFIG_DIR` / `CODEX_HOME`
  (`~/.claude/memory/tools/agent-clients-mcp-plugins.md`), never Fabio's real config. A Codex
  cold test only with Fabio's app closed.
- The CLIs fetch from GitHub at the app's request: check the privacy policy
  (cubric.studio/privacy/) still lists every outbound service.
- UI rules: components via `ComponentFactory`, BEM, context-menu/row shapes (`CLAUDE.md` snapshot).

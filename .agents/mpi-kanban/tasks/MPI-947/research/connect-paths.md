# MPI-947 research: each client's automatic connect path (2026-09-27, session 593c46ac)

All installs ran in throwaway dirs under the session scratchpad (`CLAUDE_CONFIG_DIR`,
`CODEX_HOME`). Fabio's real `~/.claude`, `~/.codex`, `~/.gemini` and Claude Desktop were
not touched (`~/.gemini/config/plugins/` was listed read-only).

## Verdict

| Client | Automatic path | Proven |
|---|---|---|
| Claude Code | `claude plugin marketplace add https://github.com/MadPonyInteractive/cubric-studio-agents.git` then `claude plugin install cubric-studio@cubric-studio` | YES, scratch config: plugin 0.1.0 enabled, `mcpServers.cubric-studio` = `http://127.0.0.1:3000/mcp` |
| Codex | `codex plugin marketplace add MadPonyInteractive/cubric-studio-agents` then `codex plugin add cubric-studio@cubric-studio` | YES, scratch home: `codex mcp list` shows `cubric-studio` enabled |
| Claude Desktop | run `claude-desktop.exe "<path>\cubric-studio.mcpb"` (MSIX execution alias) so Claude shows its OWN install preview | YES, live 2026-09-27: Fabio ran it, Claude showed its install screen (D3) |
| Antigravity | copy the plugin folder into `%USERPROFILE%\.gemini\config\plugins\cubric-studio\`, then restart Antigravity | path confirmed from Antigravity's embedded docs + Fabio's working 09-26 install; no fake-home launch |

## Claude Code + Codex (both proven)

- Both commands are **idempotent**: a repeat add/install exits 0 ("already on disk", "already
  installed"). Connect can be pressed twice.
- **Status is machine-readable**: `claude plugin list --json` returns `[{ id, version, enabled,
  mcpServers }]`; `codex plugin list --json -m cubric-studio` returns `{ installed: [{ pluginId,
  version, installed, enabled }] }`. No config-file parsing needed.
- **Disconnect is clean**: `claude plugin uninstall cubric-studio@cubric-studio` +
  `claude plugin marketplace remove cubric-studio` leaves `settings.json` with empty
  `enabledPlugins`/`extraKnownMarketplaces`; `codex plugin remove cubric-studio@cubric-studio` +
  `codex plugin marketplace remove cubric-studio` empties `config.toml` and `codex mcp list`.
- Both fetch from **GitHub** (git clone over https). Outbound call the privacy policy must list
  (check cubric.studio/privacy/).
- A running Claude Code / Codex session does not see the plugin until it restarts: the page
  says so.
- `claude mcp list` runs a HEALTH CHECK against `:3000/mcp` (it hit Fabio's live app once in
  this research). The app must use `plugin list --json`, never `mcp list`, for status.

## Spawning from Electron (Node 24 measured; Electron ^41)

- `execFile('claude')` -> ENOENT; `execFile('claude.cmd')` -> **EINVAL** (Node refuses `.cmd`
  without a shell). `execFile('claude', args, { shell: true, windowsHide: true })` works for both
  CLIs. Args are fixed literals, so DEP0190's unescaped concatenation is not an injection path;
  never pass a user string through it.
- No `detached: true` (pops a console, `windows-console-windows.md`).
- Detection = `where claude` / `where codex` through the same shell. Fabio's are npm shims in
  `%APPDATA%\npm`; a native install lives elsewhere on PATH, `where` finds both.

## Claude Desktop (code-read, `app.asar` of Claude 2.9939.2.0 MSIX)

- The MSIX manifest registers **no `.mcpb` file type**, only the `claude:` protocol. So
  `shell.openPath(file.mcpb)` would NOT reach Claude Desktop (Windows would ask what to open it
  with), and docs/mcp-server.md's "double-click `cubric-studio.mcpb`" only works if the user has
  associated the type by hand. Worth a docs correction.
- On Windows Claude reads **argv**: at cold start (`process.argv`, filtered for a DXT/MCPB path)
  and on `second-instance` when already running; both route to the `Handling DXT/MCPB file`
  handler, which opens its install preview (`jwr(manifest, path, extensionId, signatureInfo)`).
  The user still clicks Install: nothing is written without their consent.
- The manifest declares the execution alias **`claude-desktop.exe`**
  (`%LOCALAPPDATA%\Microsoft\WindowsApps\claude-desktop.exe`), which launches inside the package
  context. That is the launch target. Detection = that alias exists (MSIX) or
  `%LOCALAPPDATA%\AnthropicClaude\claude.exe` (older Squirrel install, same Electron argv code
  path, unverified on this box).
- Status: Claude Desktop keeps installed extensions under
  `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\Claude Extensions\`. CORRECTED
  2026-09-27: this note first said `%APPDATA%\Claude\...`, which only exists INSIDE Claude's MSIX
  container, where this research session ran (see validation.md).
- **Open item for Fabio**: run the alias against a real `cubric-studio.mcpb` once and confirm
  the preview appears (Cancel is fine).

## Antigravity

- Desktop app at `%LOCALAPPDATA%\Programs\antigravity`, no CLI (`resources\bin` holds only
  `language_server.exe` + `webm_encoder.exe`). Not running during this research.
- Its language server's embedded docs: customization root `~/.gemini/config/`, plugins at
  `plugins/<plugin_name>/`, each with its own `mcp_config.json` ("active when the plugin is
  enabled"); global MCP in `~/.gemini/config/mcp_config.json`.
- It registers an `antigravity://` deep link, but the handler only forwards the URL to the
  renderer (auth-style); no plugin-install route found.
- Fabio's 09-26 install (`~/.gemini/config/plugins/cubric-studio/` = `plugin.json`,
  `mcp_config.json`, `skills/`) is the working proof. Connect = copy those files, then
  "restart Antigravity". Disconnect = delete that one folder.

## Where the files come from (decision for the plan)

- `.mcpb`: already packed per release as `cubric-studio.mcpb`. Bundling it in the app build
  keeps it version-matched and offline; downloading `releases/latest/download/` is the other
  option.
- Antigravity folder: lives in the public `cubric-studio-agents` repo. Bundle a copy or fetch
  from GitHub. Bundling drifts from the repo unless the build copies it.

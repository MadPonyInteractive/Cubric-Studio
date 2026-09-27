# MPI-947 validation

Research phase started 2026-09-27 (session 593c46ac). Evidence per client lands in
`research/connect-paths.md`; nothing is built yet.

2026-09-27 research result: Claude Code and Codex connect, status (`plugin list --json`) and
disconnect PASSED in scratch `CLAUDE_CONFIG_DIR` / `CODEX_HOME`, idempotent on repeat. Node
`execFile` needs `shell: true` for the `.cmd` shims (EINVAL without). Claude Desktop: no `.mcpb`
file type; argv path via `claude-desktop.exe` found in its code, live check pending (D3).
Antigravity: target path confirmed, Fabio's install = repo folder (CRLF-only diff).

2026-09-27 build evidence (not yet Fabio-verified):
- `node --test tests/agent-connect.test.cjs` 6/6; two mutations (steps ignoring failure, disconnect
  without `all`) each turned one test red. `npm test`: 2008 tests, 0 fail (after Phase 2 too).
- Isolated instance :64035, `CLAUDE_CONFIG_DIR`/`CODEX_HOME` scratch: `GET /agent-connect/status`
  0.45 s, detected all four (Claude Desktop via MSIX alias lstat, v0.2.0 connected = Fabio's real
  install, read-only). API connect+disconnect Claude Code and Codex all `ok: true`; scratch configs
  empty after. UI: Settings > Connect an agent rendered four plates + "Any other agent"; Connect on
  Claude Code -> "Connected (v0.1.0). Restart Claude Code to load it." + Disconnect; Disconnect ->
  "Not connected.". Found + fixed: `map(_agentPlate)` passed the index as the note ("Not connected. 1").
- Open: D3 (live `claude-desktop.exe <mcpb>`), Fabio's own look at the section.

2026-09-27 Fabio's first look: Claude Desktop read "Not connected" with the extension installed.
Root cause: Claude's MSIX build virtualizes its AppData; outside the package `%APPDATA%\Claude`
does not exist (WMI-created `dir` = File Not Found) and the extension sits in
`%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\Claude Extensions\`. This
session and the isolated app it launched run INSIDE Claude's container, so they saw the
redirected folder and passed. Fix: `claudeExtensionDirs()` reads the package folder first.
Proven outside the container (route run by a WMI-started node): claude-desktop detected +
connected v0.2.0; codex connected 0.1.0, claude-code not connected, matching Fabio's screen.
Tests 9/9, `npm test` 2008 / 0 fail.

2026-09-27 Mac/Linux branches added (Fabio's question). New darwin test (platform stubbed):
`command -v`, `~/Applications/Claude.app`, Application Support extension v0.3.0 read, Antigravity
found by `~/.gemini/antigravity` alone, connect ran `open` (ENOENT on the Windows runner = the
proof). 10/10 = agent-connect 7 + windows-hide-spawn 3 in one run; `npm test` 2009 / 0 fail; Windows re-proven outside the container (same four
answers). NOT run on a real Mac or Linux machine.

2026-09-27 Fabio verified: his own app after the MSIX fix showed Claude Desktop "Connected
(v0.2.0)" + removal hint, Claude Code Connect, Codex/Antigravity Disconnect (screenshot); then
"yes to all" = section OK and D3 PASSED (Claude's install screen appeared for
`claude-desktop.exe <mcpb>`). Added after: "get it" hints for Codex/Antigravity when not installed
(7/7, `npm test` 2009 / 0 fail). Agents README pushed `b5e04c6`, verified via `gh api`.
Closes on the Vision commit's CI run (mpi-end-session).

2026-09-27 close-out: `efb7453cf` went RED on CI (run 36305138503, unit job): the stubbed-macOS
test expected `open -a` to FAIL to spawn, true on a dev box with no `open`, false on the Windows
runner that has one (red-master cause 1, fixture not product). Fix `28a8ded46`: a `launch` seam
like `run`, tests assert what would start and spawn nothing; it also caught a real bug (repeat
Connect on a connected Claude Desktop returned no note). 10/10, `npm test` 2009 / 0 fail, `npm run
lint` clean, pushed `--no-verify` as the red-master fix. **CI GREEN on `28a8ded46`** (Tests run
36305422801, unit + desktop). Closed on that run.

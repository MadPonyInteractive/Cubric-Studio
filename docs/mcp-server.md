# MCP server: outside agents drive the app (MPI-593)

Claude Code, Claude Desktop, Codex and Antigravity control the installed app through
`POST /mcp` (`routes/mcp.js`, mounted in `server.js` after `localOnly`). The in-app agent is a
different thing: [agent-chat.md](agent-chat.md). Both call the same `/connector/*` routes through
`services/agentTools.mjs`; there is no second dispatch path.

## The endpoint

- Streamable HTTP in its smallest legal form: stateless, one JSON-RPC message per POST, JSON
  answers, no SSE, no sessions. `initialize`, `ping`, `tools/list`, `tools/call`;
  notifications get 202; GET and DELETE get 405.
- `initialize` sends `instructions`. **Codex never shows them to its model** (below), and Claude
  Desktop has been seen ignoring the "read the guide first" line. Anything an agent MUST do
  belongs in a tool's own description or a gate, not only in `instructions`.
- `localOnly` runs first, so a browser page cannot reach it. Node, Rust and Python clients send
  no Origin and pass on Host alone. The HTTP API behind it is unauthenticated: a shell-capable
  agent that cannot see the tools will scrape it instead (Codex did, 2026-09-26).

## The 17 tools

`status`, `list_models`, `describe_model`, `list_projects`, `create_project`, `open_project`,
`list_cards`, `view_card`, `rename_card`, `generate`, `wait_generation`, `cancel_generation`,
`read_knowledge`, `make_gif`, `edit_gif`, `cutout_gif`, `gif_to_video`. Every one has a
`title` and annotations (the Claude Desktop directory requires them). **None deletes or
installs**: every request goes through `agentTools.mjs`, whose route allowlist
`tests/agent-no-delete.test.cjs` pins, and `tests/mcp.test.cjs` asserts `destructiveHint: false`
on every tool that writes.

- **Waits.** Most clients give a tool call 60 s. `generate` answers within `WAIT_MS` (45 s,
  `CUBRIC_MCP_WAIT_MS`); a slower job returns `{ running: true, jobId }`, and each
  `wait_generation` waits another 45 s. A video or a Flow answers `running` after 3 s so the
  chat is not gagged. Before this, a 73 s render read as a failure and the agent ran it twice.
- **Cancel.** A job is submitted with `requestId = jobId`, so `cancel_generation` and a client's
  `notifications/cancelled` for the blocked call both reach `/connector/cancel`.
- **Spend gate** (`spendGate`). Every generate is quoted through `/connector/quote`. A billed run
  answers `CONFIRM_COST` with the price and submits nothing until the call repeats that price in
  `confirmCost`. Local models and Flows never ask.
- **The project is named, not inherited** (MPI-873). `generate` and `list_cards` take
  `folderPath`; `openFolder` checks it holds a `project.json` (else `PROJECT_NOT_FOUND`), and
  `/connector/generate` swaps it for the project list's spelling, because the renderer decides
  "open or closed?" by exact string. A closed project is fine: `agentDispatch.targetProject`
  reads it over `/get-project` and `generationService` registers the card through
  `/project-groups`. Without `folderPath` a run lands in whatever is open when it runs. The GIF
  tools still work on the open project only.
- **Reference images.** `media: [{ role, path }]`: a path on the user's disk is staged into the
  project `folderPath` names, else the one `GET /connector/current-project` names. An image
  pasted into the user's chat never reaches us as a file, so an input is a card or a disk path.
  A video in a picture role goes as its first frame (`/connector/generate`, MPI-980).
- **Results** carry the disk path plus the gallery's 512px thumb as MCP `image` content, so a
  vision model sees what it made. `view_card` (`services/cardView.js`) shows a still, or a video
  or GIF as ONE contact sheet (frames picked by index, GIF delays from sharp).

## The Claude Desktop bundle (`mcp/cubric-studio/`)

Claude Desktop extensions speak stdio only, so `server/index.js` bridges stdio to the app's
`/mcp`, one line per message, over `node:http` (fetch dies at 300 s waiting for headers). No tool
lives in the bridge, so a new tool never needs a new bundle. When the app is closed, the bridge
answers `initialize` itself, lists `status` alone, and sends `notifications/tools/list_changed`
once the app is up. `manifest.json` carries its own version (not the app's): bump it only when
the bridge or the manifest changes.

**Released in `MadPonyInteractive/cubric-studio-agents`**, as `cubric-studio.mcpb` on a
`mcpb-v<version>` release, so
`https://github.com/MadPonyInteractive/cubric-studio-agents/releases/latest/download/cubric-studio.mcpb`
is the permanent link. It is the one everything reads: the Settings page
(`routes/agentConnect.js` `MCPB_URL`), the agents README, and the MCP Registry, whose `server.json`
names the versioned URL plus its `fileSha256` (the Registry only accepts a release URL containing
`mcp`, which a `Cubric-Studio/releases/...` URL is not). The app release also attaches a copy (the
release skill, step 6); nothing reads that one. A new bundle, only when the bridge or manifest
changed:

```bash
npx -y @anthropic-ai/mcpb@2.1.2 pack mcp/cubric-studio <scratch>/cubric-studio.mcpb
```

then `gh release create mcpb-v<ver> --repo MadPonyInteractive/cubric-studio-agents <scratch>/cubric-studio.mcpb`,
bump `version` and `fileSha256` in that repo's `server.json`, and `mcp-publisher publish` from it
(`~/.claude/memory/tools/agent-clients-mcp-plugins.md`).

The pack validates the manifest; the archive must hold exactly `manifest.json`, `README.md`,
`server/index.js`.

## The plugin (public repo `MadPonyInteractive/cubric-studio-agents`)

**It lives ONLY in that repo** (moved out of `mcp/listing/` 2026-09-26; clone at
`c:\AI\Mpi\cubric-studio-agents`), because Claude Code and Codex read `marketplace.json` from a
repo's ROOT. A tool change needs no plugin change: the tools live in the app. One folder serves
Claude Code, Codex AND Antigravity: `.claude-plugin/marketplace.json` plus `plugins/cubric-studio/` with
`.claude-plugin/plugin.json` + `.mcp.json` (Claude Code, Codex), `plugin.json` + `mcp_config.json`
(Antigravity, `serverUrl`), and one `skills/cubric-studio/SKILL.md` all three load. Codex reads the
`.claude-plugin/` files and the Claude-format `.mcp.json` as they are; no `.codex-plugin/` is
needed. The skill is the part that matters: it names the server, says the tools may be deferred
and how to find them, and forbids the browser and the raw HTTP API. `claude plugin validate`
must pass on both the folder and the plugin. Cold-tested 2026-09-26 in all three: one image
each, MCP only, the guide read first (Claude Code via `--plugin-dir`, tools named
`mcp__plugin_cubric-studio_cubric-studio__*`; Antigravity by Fabio in the desktop app).

**Only an agent running on the user's computer can reach `127.0.0.1`.** Browser chatbots
(ChatGPT's chat, Gemini on the web) call MCP from their own cloud, so they never can; ChatGPT
users come in through Codex, which their plan includes. **Gemini CLI is not a target**: Google
stopped serving it to personal logins on 2026-06-18 (`IneligibleTierError`), and Antigravity
replaced it.

## Settings > Connect an agent (MPI-947)

`routes/agentConnect.js` runs the per-client steps below for the user, one plate each in
Settings (inline in `MpiSettings.js`: a Compound mounts Primitives only). `GET /agent-connect/status`
detects each client and reads whether ours is installed; `POST /agent-connect/:id/connect|disconnect`
acts and answers with the status after. Every file comes from `cubric-studio-agents` (the `.mcpb`
from its latest release, the Antigravity folder from `main`), so connect needs internet.

- Status reads `claude plugin list --json` / `codex plugin list --json`, **never
  `claude mcp list`**: that one health-checks every server, i.e. pings the live app.
- The CLIs are npm `.cmd` shims: `exec` with a shell and `windowsHide`, fixed literal
  command lines only. Node refuses a `.cmd` without a shell (EINVAL).
- Claude Desktop is found by `lstat` on the MSIX alias `%LOCALAPPDATA%\Microsoft\WindowsApps\claude-desktop.exe`:
  `existsSync` says FALSE for it (stat gets EACCES on the reparse point). Installed = a folder
  ending `cubric-studio` in `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\Claude Extensions\`:
  MSIX virtualizes Claude's AppData, so **`%APPDATA%\Claude` does not exist outside the package**.
  A process started from Claude (a Claude Code session in the desktop app, and any app IT
  launches) sees the redirected view, so a test from there passes on the wrong path; list the
  real view from a WMI-created process (`Win32_Process.Create`). No Disconnect button: the page
  says where Claude's own Uninstall is.
- "Last used" comes from the `clientInfo` a client sends on `initialize` (`routes/mcp.js`
  `seenClients()`, in memory since launch). Names seen that match no known client are listed
  as-is. The Claude Desktop bridge answers `initialize` itself when the app was closed, so it
  shows only after its next connect.
- **Platforms.** Windows is proven on a real machine. macOS and Linux branches exist but are
  unrun on real hardware (the builds are blocked too): CLIs found by `command -v` with Homebrew,
  `/usr/local/bin`, `~/.local/bin` and `~/.npm-global/bin` added to PATH (a Dock-launched Mac
  app gets launchd's bare PATH); Claude Desktop at `/Applications/Claude.app`, extensions in
  `~/Library/Application Support/Claude/Claude Extensions`, the `.mcpb` handed over by
  `open -a` (Claude's `open-file` handler); no Claude Desktop on Linux; Antigravity found by
  its `~/.gemini/antigravity` data folder on every OS. First Mac or Linux tester: check this page.
- Research behind every path: `.agents/mpi-kanban/tasks/MPI-947/research/connect-paths.md`.

## Per client

| Client | Connect | Catch |
|---|---|---|
| Claude Code | `claude plugin marketplace add https://github.com/MadPonyInteractive/cubric-studio-agents.git`, then `claude plugin install cubric-studio@cubric-studio` | the `owner/repo` shorthand clones over SSH and fails without a GitHub SSH key |
| Claude Desktop (Windows, macOS; none on Linux) | app: `claude-desktop.exe "<path>\cubric-studio.mcpb"` (macOS `open -a Claude`), Claude shows its own install screen. By hand: drag the file onto Claude's Settings > Extensions page | on Windows Claude registers NO `.mcpb` file type, so a double-click reaches it only if the user associated the type; tools deferred inside Claude Code sessions of the Desktop app |
| Codex | `codex plugin marketplace add MadPonyInteractive/cubric-studio-agents`, then `codex plugin add cubric-studio@cubric-studio` | a bare `codex mcp add` is not enough, see below |
| Antigravity (desktop) | copy the repo's `plugins/cubric-studio/` into `~/.gemini/config/plugins/`, restart | no install-from-GitHub documented; every tool call asks for approval by default |

**Codex (0.157) always defers MCP tools.** Its model sees one `exec` tool; ours sit in
`ALL_TOOLS` and are found only if the model thinks to filter it, and our `instructions` never
reach it. A plain request web-searched, or drove the app through a browser for 2 minutes first.
No config key un-defers. A skill naming the server and the `ALL_TOOLS` filter fixes discovery,
so Codex ships as a plugin (skill + `.mcp.json`), not a bare `mcp add`. In `codex exec`
(approval `never`) every tool without `readOnlyHint: true` is refused unless
`-c mcp_servers.cubric-studio.default_tools_approval_mode="approve"`; interactive Codex asks the
user, which is right. With the plugin installed, a cold `codex exec` from an empty folder made
one image in 71 s through MCP alone and read the model guide first (2026-09-26). Probe and
cold-test record: `.agents/mpi-kanban/tasks/MPI-593/validation.md`.

## Testing

- `node --test tests/mcp.test.cjs tests/card-view.test.cjs tests/agent-connect.test.cjs`.
- Connect / Disconnect live: launch the isolated instance with `CLAUDE_CONFIG_DIR` and
  `CODEX_HOME` pointed at scratch folders; never press Antigravity or Claude Desktop there (they
  are the user's real installs).
- **Cold test**: a client with no Cubric context, one sentence, against an isolated instance
  (`APP_DOCUMENTS=<scratch> node scripts/launch-instance.mjs`; READY prints the port). The proof
  is the files on disk and how many landed, never the agent's report.
- The isolated instance shares the user's ComfyUI on 48188: check its queue first, and never
  test a cancel while the user's app is rendering (it killed two of Fabio's renders).
- **A shell-capable cold agent (Codex) is not fenced by MCP config.** Run it only with the
  user's app closed. Claude Code with `--strict-mcp-config --allowedTools 'mcp__cubric__*'`
  stays fenced.
- To learn how a client treats MCP without touching the app, point it at a throwaway MCP server
  that logs every method and answers a nonce.

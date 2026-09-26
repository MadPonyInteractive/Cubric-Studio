# MPI-593 Validation

## Phase 1: the MCP spike (2026-09-25, PASSED, auto)

**Unit:** `node --test tests/mcp.test.cjs`: 10 pass, 0 fail. The tests cover the protocol
(version echo, notification 202, GET 405, unknown method -32601), each tool reaching its
route, `list_models` being the compact catalogue, and the slow-job path. The slow-job test
fails without the fix, because the first `generate` then returns the result itself and not
`running`.

**Manifest:** `npx @anthropic-ai/mcpb validate mcp/cubric-studio/manifest.json` gives
`Manifest schema validation passes!`. `mcpb pack` gives `cubric-studio-0.1.0.mcpb`, 2.1 kB,
2 files.

**Live, through the stdio bridge** (what Claude Desktop runs). This was an isolated instance
(`launch-instance.mjs`, its own port) with `APP_DOCUMENTS` set to a scratch folder, so
`list_projects` returned `[]` and no real project was touched.
- `initialize` returns `2025-06-18`, `cubric-studio 1.6.1`. `status` returns `ready: true`.
- `list_models` returns 20,268 chars (~5k tokens): the compact catalogue, still the biggest answer.
- `create_project "MCP spike"` returns `opened: true`, and `describe_model sdxl-realistic` works.
- `generate sdxl-realistic t2i "a red bicycle…" cardName "Red bicycle"` returns `ok` in 21.9 s,
  and `MCP spike/Media/t2i_001.png` is on disk at 1024x1024. It was opened and checked by eye:
  a red bicycle against a brick wall.

**Cold agent 1: Claude Code headless (Sonnet), HTTP straight to `/mcp`, no Cubric context.**
The prompt was one sentence: "Cubric Studio is open on this computer. Make me an image of a
yellow taxi in the rain at night, in a new project called Taxi test…". **It got there unaided,
but with THREE images for one ask.** Server log: `create_project`, `list_models`,
`describe_model`, `generate` (12:35:34), `status`, `generate` (12:36:51), `generate`
(12:37:56). File times: `t2i_001.png` at 13:36:48 and `t2i_002.png` at 13:37:54 (local),
63-73 s after their calls. The client stopped waiting at about 60 s. The agent reported "2k
tier timed out twice", dropped to 1k, and never knew that the first two had landed.
**This is the same failure the in-app agent had on 2026-09-19 with fetch's 300 s limit, one
layer up.** On a paid model it is a double bill.

**Fix:** `generate` answers within 45 s (`WAIT_MS`), and a slower job returns
`{ running: true, jobId }` with a new tool, `wait_generation`. The server `instructions` and
the tool description both say never to re-send `generate`.

**Cold agent 2**: the same setup and prompt, plus "in the best quality it can do", in project
"Taxi test 2". Server log: `status`, `list_models`, `create_project`, `describe_model`, ONE
`generate` (12:40:34), then five `wait_generation` calls, about 46 s apart. The file is
`Taxi test 2/Media/t2i_001.png`, **the only file**, landed 13:44:58 local after a 4 min 24 s
2K render. The agent picked Krea 2 (rank 1, local, free), turned turbo off, skipped the paid
models on its own, and named the card. Cost: $0.43, 14 turns.
Its one complaint: "I couldn't open the file myself, so I haven't seen it". That is plan
phase 2 item 3.

**Claude Desktop, Fabio's own install (2026-09-25, PASSED, by Fabio).** He double-clicked the
`.mcpb`, installed it with the port at 3000, and fully relaunched the app. The prompt was one
sentence: "Make me an image of a red bicycle in Cubric Studio, in a new project called MCP test.
Use a free local model." Claude called `status`, `create_project`, `list_models`,
`describe_model` and `generate`. **One card** landed in the new project "MCP test": "Red
bicycle", Krea 2 t2i, 1152x896, 31 s. His screenshots show both the chat and the gallery.
Two UX findings for phase 2:
- Installing an unlisted `.mcpb` shows Claude Desktop's red warning: "Installing will grant this
  extension access to everything on your computer… not verified by Anthropic."
- Claude asks permission once per tool until the user picks "Always allow".

The extension also loads into Claude Code sessions inside the desktop app, where its tools
are deferred. This session saw `mcp__Cubric_Studio__*` appear and did not call them, because
they drive the live `:3000` app.

**Codex in VS Code, Fabio's machine (2026-09-25, PASSED, slow).** Set up with
`codex mcp add cubric-studio --url http://127.0.0.1:3000/mcp`, using the same sentence and the
"5.6 Luna Light" model. **One card**: Krea 2, 1024x1024, 38.5 s render. Fabio had deleted the
first "MCP test" in the UI at 13:08:42Z, per app.log, so this is a fresh project, not an
overwrite. The whole run took 3 min 7 s. The Codex session log accounts for it:
- 13:10:45 to 13:12:47Z (**2 min**): Codex tried to drive the app through a BROWSER. It read
  Fabio's personal Playwright skill (`~/.agents/skills/playwright`) and ran `npx playwright-cli
  open http://127.0.0.1:3000 --headed`, then a snapshot, each waiting 30 s.
- 13:12:47Z: it searched its tool list for `/cubric|image|studio|project|model/`, found the MCP
  tools, and from there took 56 s: two lists, create, describe, one `generate` that answered
  as the render landed, and its reply.

So the delay is Codex choosing a browser skill first, not our server. A user without a Playwright
skill should not hit it. Codex's final link was the `/project-file?path=` URL, which is dead
outside the app. That is phase 2 item 3 again.

**Cost check, live in Claude Desktop with real money (2026-09-25, PASSED, by Fabio).** He shared
the transcript. The request was "a video of a lizard climbing a wall in cartoon style, the best
video model". Claude picked MiniMax H3 (local, free). The chat went SILENT through the render,
and Fabio cancelled it in the app, per app.log (`CANCELLED` at 13:27:30Z, mid-`wait_generation`).
Claude then GUESSED at a VRAM cause, because the CANCELLED text does not say who stopped it.
Asked "how about paid ones?", Claude listed the cloud models with prices and asked first. Then,
for Seedance 1.5 Pro, the gate did its job twice: `CONFIRM_COST` at "about $0.30" (1080p 5 s),
and Claude told him and offered cheaper settings. He asked for the shortest and lowest, got
`CONFIRM_COST` at "about $0.05" (480p 1 s), and said yes. One run: `t2v_001.mp4`, 496x864,
billed $0.0487. Claude MCP log: `generate` ids 19 and 20 are quote-only (8 ms each); id 21 is
quote plus submit, and returned 39 s later. Findings, all now in `plan.md` phase 2: the silent
render (1b), unread guides (1c), and "I can't play the video myself" (3).

**Privacy (message 90fd9914, 2026-09-25, PASSED).** Commit `0bcac13c`: `privacy_policies` in the
manifest, `mcp/cubric-studio/README.md` with the audited Privacy Policy section, and a
`long_description` that says what reaches Anthropic. `npx -y @anthropic-ai/mcpb validate
mcp/cubric-studio/manifest.json` -> `Manifest schema validation passes!`

**Phase 2 items 1b, 1c and 3 (2026-09-25, session ae16d6d6).** `node --test tests/mcp.test.cjs`
-> 16/16 (6 new: requestId, disk path + image content, video running at once + cancel, Stop in
the chat, a stop in the app, read_knowledge). Live on an isolated instance (`APP_DOCUMENTS` =
scratch, port 62646):
- `read_knowledge` with no id -> 47 guides; `guide:sdxl` -> 9,476 chars.
- SDXL t2i "a red bicycle against a brick wall" -> first call `running` at 45.1 s (cold
  engine), `wait_generation` -> `filePath` = the real `...\MCP phase2\Media\t2i_001.png`, plus
  `image/webp` content, 67,916 bytes = the gallery's own `.meta/<itemId>.thumb.webp`, 512x682.
  Opened by eye: a red bicycle against a brick wall. A warm run: 17.3 s, 14 kB picture.
- Stop in the chat (`notifications/cancelled` for the blocked `generate`) at 1.5, 3.5, 5 and
  8 s into an SDXL run -> each answered `CANCELLED ... pressed Stop in the chat` within 0.1 to
  0.6 s, and no file landed. The `/history` of the engine shows each prompt
  `execution_interrupted`.
- MiniMax H3 t2v_ms -> `running` at once (3.1 s, the "end your turn" text).
- **FAILED twice, and not in routes/mcp.js:** one SDXL Stop at 5 s (13:58:31Z), and
  `cancel_generation` on the H3 job 11 s in (14:03:23Z). The renderer answered
  `cancelled: true`, but the held `/connector/generate` never answered: no CANCELLED, no
  file, still `running` 9 min later (the connector's 30-min timeout would end it). Cause,
  from the engine's `/history`: the isolated instance ATTACHES to the user's ComfyUI on
  48188 (MPI-484). The H3 job was still pre-register, waiting on an engine busy with a render
  of Fabio's app (`fec48cbb`, started 14:02:56Z, before my 14:03:12Z submit). The pre-register
  `exec.cancel()` falls to a bare `interrupt()`, which killed THAT render
  (`execution_interrupted@14:03:23`), and nothing ever fired my job's `onCancel`. The 5 s SDXL
  failure is the same: my job queued behind Fabio's H3 `047e722a`, and my Stop at 13:58:31Z
  interrupted it (`interrupted@13:58:32`). **So this test killed two of the user's renders.**
  (His H3 `eae79bed` also ended `interrupted` at 13:57:51Z, but my instance sent no cancel
  then, and every renderer `interrupt()` is cancel-driven, so that one is not attributed.) Two
  renderer defects in `js/services/commandExecutor.js` (not this card's files; reported to
  Fabio): a pre-register cancel settles nothing, and an interrupt has no owner on the shared
  engine.

**Not checked:**
- Gemini / Antigravity.
- A video, a Flow, a paid cloud model.
- The app closed while a client connects: the bridge returns its error, but no client has
  been seen handling that.

**Phase 2 items 2, 4, 5, 6 (2026-09-26, session 9e0c3d22, PASSED, auto).**
`node --test tests/mcp.test.cjs` -> 21/21 (5 new: every tool titled + annotated, reference
images, list_cards paths, rename_card, a slow GIF cut-out as a job, the bridge with the app
closed). `npx -y @anthropic-ai/mcpb validate mcp/cubric-studio/manifest.json` -> passes.
Live on an isolated instance (`APP_DOCUMENTS` = scratch, port 62381; `:48188/queue` empty
before each render):
- `create_project mcp-ref-test`, then SDXL i2i with `media: [{ role: inputImage, path: <a png
  OUTSIDE the project> }]` -> `ok`, 17.8 s. The file is staged as
  `Media/.preview-assets/79ee377c….png`, sha256 equal to the source, and the item's sidecar
  `mediaItems[0].url` names that staged copy.
- A second i2i from the result's own `Media/i2i_001.png` path -> `ok`, and `.preview-assets`
  still holds ONE file: a card's file passes as it is, never copied.
- `list_cards` -> each row carries `path` + `itemId`, no `ref`. `rename_card` -> the card
  reads "Mascot via MCP". `make_gif` from the two item ids -> `gif_001.gif`, 2 frames;
  `edit_gif fps 2` -> `gif_002.gif` on the same card. A missing path -> `FILE_NOT_FOUND`.
- Bridge against the live instance: `initialize` + `tools/list` forward, 16 titles. With the
  app down (port 1): `tools/list` answers `status` alone, and the bridge exits 0 in 0.1 s when
  stdin closes (the poll timer is `unref`ed).
- **Cold agent 3: Claude Code headless (Sonnet), `--strict-mcp-config` to the isolated port.**
  One sentence: edit the picture at a scratch path, "the same character, now wearing a red
  scarf", new project "Ref test", a free local model. Server log: `list_models`,
  `list_projects`, `describe_model`, `create_project`, `read_knowledge`, ONE `generate`.
  Disk: `Ref test/Media/edit_001.png`, **the only file**, plus the staged input. Opened by
  eye: the same camera-head robot, red scarf at the neck. Klein 9B `kleinEdit`, $0.37, 9 turns.
- **Codex headless: FAILED, and it touched Fabio's live app.** The global `codex-cli` was
  0.135.0, too old for his default `gpt-5.6-luna`; upgraded to 0.157.1 with his OK. Then
  `codex exec -s read-only -c mcp_servers.cubric.url=<isolated>/mcp` ran 38 shell calls and
  **no MCP tool**: the session file never contains our server `instructions`, so the tools
  never reached the model (Codex's own loading, not this server). It read Fabio's Playwright
  skill (the browser failed, sandbox EPERM), then scraped the app's JS off **`:3000`** and
  POSTed there: `/create-project` made an EMPTY `Documents/Cubric Vision/Projects/Codex ref
  test` (07:26 local); `/connector/generate` was refused `NO_PROJECT`, so nothing rendered.
  His `~/.codex/config.toml` also still lists `cubric-studio` at `:3000/mcp`. Two lessons: a
  shell-capable cold agent cannot be fenced off the live app by MCP config alone, so a Codex
  cold test needs Fabio's app closed; and a user's Codex that cannot see the tools will
  scrape the unauthenticated HTTP API instead.

**current-project + view_card (2026-09-26, session 9e0c3d22, PASSED, auto).** MPI-916 landed
`GET /connector/current-project` (`f0d3018a`, on Fabio's go); `routes/mcp.js` now asks it on
every reference image and `list_cards` instead of remembering the last project it opened.
New `services/cardView.js` + `view_card` tool: a still at most 1024px; a video or GIF as ONE
contact sheet of frames from the middle of n equal slices, with their times.
`node --test tests/card-view.test.cjs tests/mcp.test.cjs` -> 24/24. Two defects were found
live and each is pinned by the test first failing on it:
- **Undecodable sheet:** `-f webp -` to a pipe wrote a zero RIFF size (the muxer seeks back,
  which a pipe allows only inside its 32 KB buffer); flat test colours stayed under 32 KB. Now
  PNG through `image2pipe`, webp by sharp; the test clip carries noise to go over 32 KB.
- **Black last cell:** an `fps=` time sampler dropped the last frame of a real 1.87 s clip.
  Now frames are picked by index (GIF: sharp's `pages` + `delay`, since ffprobe gives a GIF no
  duration); the test clip is 1.86 s at 24 fps.
Live, isolated instance (port 61401): `current-project` -> NO_PROJECT before `open_project`, the
folder after; an SDXL i2i with an outside file staged into that folder (`.preview-assets` 1 -> 2);
`view_card` on a real 1152x480 clip -> 6 cells, 1544x432, decodes; opened by eye, a figure walking
through backlit fog. Helper on a real 28-frame GIF -> 6 cells, the duck turning away.
`mcpb validate` passes; repacked `cubric-studio-0.2.0.mcpb` (17 tools).
In-app agent: `look` wiring asked of MPI-916 (message `a082a6a6`), `agentLoop.mjs` is theirs.

**Claude Desktop cold test, extension 0.2.0, Fabio's own app (2026-09-26, PASSED, by Fabio).**
He installed the repacked `.mcpb` (17 tools listed, version 0.2.0), fully restarted Cubric Studio
and Claude Desktop, Sonnet 5. Screenshots shared.
- "open the project 1.4 media and tell me what happens in the video extended_001" -> app.log
  `[mcp]`: `list_projects`, `open_project`, `list_cards` x2, `view_card`. Claude showed the
  contact sheet and described it correctly: a silhouetted figure on wet asphalt, backlit fog,
  slow steps; 1152x480, ~1.9 s, has audio.
- "make a new project called Desktop ref test, then take the picture at ...\happy.png and make a
  version of it wearing a red scarf, free local model" -> `create_project`, `list_models`,
  `describe_model`, ONE `generate`. Disk: `Desktop ref test/Media/edit_001.png`, **the only
  file**, and `.preview-assets/79ee377c….png` = the sha256 of `happy.png`. Klein 9B `kleinEdit`.
  Finding: it did NOT call `read_knowledge` before its prompt, despite the instruction.

**Why `codex exec` never used the tools (2026-09-26, session 5bdb59e7, FOUND, no app touched).**
Probed with a throwaway MCP server (`lighthouse`, one read tool + one write tool, a nonce
answer, every JSON-RPC method logged) on :47911, `cubric-studio` disabled, `-s read-only`,
while Fabio's app stayed up on :3000 and was never contacted. Codex 0.157.1 run by run:
1. Plain question ("What is the Lighthouse Weather forecast code for Lisbon?"): Codex sent
   `initialize`, `tools/list`, then **web-searched** and invented an answer. No `tools/call`.
   The rollout holds neither the tool nor the server `instructions` string.
2. "Using the lighthouse MCP server, ...": found and called the tool, which then FAILED:
   `MCP tool call requires approval, but approval policy is never`.
3. Same + `-c mcp_servers.lighthouse.default_tools_approval_mode="approve"`: PASSED, nonce
   returned.
4. `readOnlyHint: true` tool ran with no approval; the `readOnlyHint: false` one was refused.
5. Plain question again, with a 6-line skill in `<cwd>/.agents/skills/lighthouse/SKILL.md`
   saying the tools are deferred and how to filter `ALL_TOOLS`: the model read the skill and
   **called the tool**. PASSED.

Cause, from Codex's own `exec` tool text in `codex.exe`: Codex runs in code mode (one `exec`
tool) and ALWAYS defers MCP tools (`tool_search_always_defer_mcp_tools`, removed = forced on):
"Some deferred nested tools may be omitted from this description ... To find one, filter
`ALL_TOOLS` by `name` and `description`." Server `instructions` never reach the model. There is
no per-server un-defer key (`RawMcpServerConfig`: `enabled_tools`, `disabled_tools`,
`omit_tools_from`, `tool_timeout_sec`, `default_tools_approval_mode` = auto|prompt|writes|approve).
The VS Code run on 09-25 found our tools only after 2 minutes, by filtering `ALL_TOOLS` itself.
**Nothing our server sends fixes discovery; a skill does.** Codex plugins (`codex plugin
marketplace add`) bundle skills + `.mcp.json`, and `codex.exe` also reads
`.claude-plugin/plugin.json`, so the phase 3 Claude Code plugin may double as the Codex one.
Unverified until built. Headless cold tests need `default_tools_approval_mode="approve"`; an
interactive user gets an approval prompt for write tools, which is right.
The Cubric cold test itself is still owed, and only with Fabio's app closed.

**Public listings repo (2026-09-26, session 2dc5c58a, Fabio's go).** Created PUBLIC
`MadPonyInteractive/cubric-studio-agents` (`5978e2f` the plugin folder + README + AGPL-3.0
LICENSE, `d423922` README fix); an unauthenticated raw fetch of `marketplace.json` answers 200.
Install from GitHub proven in THROWAWAY homes (Fabio's configs untouched):
- Claude Code 2.1 (`CLAUDE_CONFIG_DIR`=scratch): `plugin marketplace add
  MadPonyInteractive/cubric-studio-agents` FAILED, it clones over SSH ("No ED25519 host key is
  known for github.com"); the `https://github.com/...git` URL added it, `plugin install
  cubric-studio@cubric-studio` installed, `plugin list` enabled 0.1.0. README says use the URL.
- Codex (`CODEX_HOME`=scratch, no auth): `marketplace add MadPonyInteractive/cubric-studio-agents`
  resolved to HTTPS, `plugin add` installed, `codex mcp list` shows the server at `:3000/mcp`.
Then the move: Fabio's `~/.codex/config.toml` marketplace repointed local -> git (backup diffed:
only that block changed), a working clone at `c:\AI\Mpi\cubric-studio-agents` (diff = identical
to `mcp/listing/`), and `mcp/listing/` removed from this repo (`git rm`).
Also Fabio's follow-up in Antigravity (Gemini 3.1 Pro Low): "replace the bicycle with a motorbike"
-> ONE `generate` (answered running), ONE `wait_generation` when he asked to see it;
`edit_001.png` landed, 2 media files in the project in total. Fabio: "more than enough", stop.

**Antigravity PLUGIN cold test (2026-09-26, session 2dc5c58a, PASSED, run by Fabio).** Antigravity
desktop (no `agy` CLI ships with it), fresh install, no Google plugins ticked. The plugin folder
`mcp/listing/plugins/cubric-studio/` gained `plugin.json` + `mcp_config.json` (`serverUrl`
`:3000/mcp`) and was COPIED into `~/.gemini/config/plugins/cubric-studio` (still installed there).
Settings showed skill `cubric-studio` (Plugin: cubric-studio) and MCP server
`cubric-studio_cubric-studio`, 17 tools enabled. Target: Fabio's own app (open, :3000). Gemini 3.8
Flash High, a conversation in Antigravity's `MpiAiSuite` workspace (no Cubric hints), the same
sentence, project "Antigravity test"; Fabio approved each tool call, nothing else.
- app.log 16:05:01Z-16:06:07Z: `status`, `create_project`, `list_models`, `describe_model`,
  `read_knowledge`, ONE `generate` (quote, then submit: krea2 t2i, 4:3, 1k, turbo). MCP only, no
  stray route hits. "Worked for 2m" including approvals.
- Disk: `Documents/Cubric Vision/Projects/Antigravity test/Media/t2i_001.png`, **the only media
  file**, plus its sidecar and thumb, `project.json`, `project.md`. Seen by Fabio: a red bicycle
  against a stone wall, card named "Red Bicycle".
So one plugin folder is proven in Claude Code, Codex AND Antigravity. Claude validators still pass
with the Antigravity files present; `codex mcp list` still shows the server.

**Gemini CLI extension (2026-09-26, session 2dc5c58a, BUILT, cold test BLOCKED by Google; DROPPED).**
`mcp/listing/gemini-extension.json` (repo root: `gemini extensions install <github url>` has no
subfolder flag), `httpUrl` to `:3000/mcp`, `contextFileName` pointing at the plugin's SKILL.md so
one skill serves all clients. `gemini extensions validate` and `claude plugin validate` pass on
the folder. Gemini CLI 0.61.0 (Fabio OK'd `npm i -g`, logged in himself): a local-path install
HANGS silently on a folder-trust `[y/N]` prompt that `--consent` does not cover (answer `y` on
stdin); the port-swapped copy then installed and `gemini mcp list` showed `cubric-studio ...
(http) - Connected` against the isolated instance (:57950, 0 projects). The cold `gemini -p` died
in 4 s: `IneligibleTierError: This client is no longer supported for Gemini Code Assist for
individuals ... migrate to the Antigravity suite`. Google stopped serving Gemini CLI for free and
AI Pro/Ultra personal logins on 2026-06-18; only paid API keys and enterprise remain. The
successor is Antigravity CLI (`agy`), whose plugins are `plugin.json` + `mcp_config.json`
(`serverUrl`) + `skills/`. Cleanup: test extension uninstalled, the two scratch entries removed
from `~/.gemini/trustedFolders.json`, instance stopped (:57950 closed). No media made.

**Claude Code PLUGIN cold test (2026-09-26, session 5bdb59e7, PASSED).** Fabio's app closed
(:3000 down). Isolated instance on :59605, scratch `docs3` (0 projects before). A scratch COPY of
`mcp/listing/plugins/cubric-studio` whose only diff is the `.mcp.json` port (3000 -> 59605), so
Claude Code's own plugin MCP loading was exercised, not an override. `claude -p` 2.1.278, empty
cwd, `--plugin-dir <copy> --setting-sources local --permission-mode dontAsk --allowedTools
"mcp__plugin_cubric-studio_cubric-studio__*,Skill,ToolSearch" --model sonnet
--no-session-persistence`, same sentence, project "Claude plugin test". (`--bare` would be
colder but reads only ANTHROPIC_API_KEY, not OAuth.) The global CLAUDE.md still loaded.
- init: server `plugin:cubric-studio:cubric-studio` connected, `source: plugin`; 17 tools as
  `mcp__plugin_cubric-studio_cubric-studio__*`; skill `cubric-studio:cubric-studio` listed.
- It ran the skill, then `status`, `create_project`, `list_models`, `describe_model`,
  `read_knowledge` (`guide:krea-2`), ONE `generate`. 59 s, 11 turns, $0.29, 0 permission denials.
- Disk: `Claude plugin test/Media/t2i_001.png`, the only media file. Opened by eye: a red steel
  bicycle against a white brick wall, as its reply described. Krea 2.
So one plugin folder is proven in BOTH Claude Code and Codex. Gemini is not built.

**Codex PLUGIN cold test (2026-09-26, session 5bdb59e7, PASSED; Fabio OK'd the local install).**
Plugin in `mcp/listing/` (shaped as the future public repo root): `.claude-plugin/marketplace.json`
+ `plugins/cubric-studio/{.claude-plugin/plugin.json, .mcp.json, skills/cubric-studio/SKILL.md}`.
No `.codex-plugin/` needed: `codex plugin marketplace add C:\AI\Mpi\Cubric-Vision\mcp\listing` then
`codex plugin add cubric-studio@cubric-studio` installed it (`installed, enabled 0.1.0`), and with
Fabio's own `[mcp_servers.cubric-studio]` entry commented out `codex mcp list` still showed
`cubric-studio` at `:3000/mcp`, so Codex parses the Claude-format `.mcp.json` (`type: http`).
`claude plugin validate` passes on the marketplace and the plugin.
- Running an instance ON :3000, to test the URL unmodified, was refused by auto mode (Fabio's
  port). So the isolated instance ran on :51935 and `-c mcp_servers.cubric-studio.url=` pointed
  the plugin's server there (`codex mcp list` confirms a `-c` URL replaces the plugin's). The
  `:3000` URL itself is the one Fabio's VS Code Codex used on 09-25.
- Cold run from an EMPTY cwd (the only Cubric skill = the plugin's), same sentence, project
  "Codex plugin test", approve flag: 71 s. It read the plugin skill (one wrong-path try first),
  then `status`, `list_projects`, `list_models`, `create_project`, `describe_model`,
  `read_knowledge`, ONE `generate`. No browser, no HTTP scraping.
- Disk (scratch `docs2`, 0 projects before): `Codex plugin test/Media/t2i_001.png`, the only media
  file. Opened by eye: a red bicycle on a woodland path. Krea 2.
- Fabio's `~/.codex/config.toml`: his entry restored; the install added only
  `[marketplaces.cubric-studio]` and `[plugins."cubric-studio@cubric-studio"]` (backup diffed).
Not tested: the same plugin in Claude Code (validated only), Gemini (not built).

**Codex cold test (2026-09-26, session 5bdb59e7, PASSED; closes item 7).** Fabio's app closed
(:3000 and :48188 down). Isolated instance on :58984 with `APP_DOCUMENTS` = a scratch folder
(`list_projects` answered 0 projects; main.js's `APP_DOCUMENTS set to` log line prints Electron's
own Documents path, not the env value the server gets, so do not trust that line). `codex exec`
0.157.1, `-s read-only`, `-c mcp_servers.cubric-studio.url=...:58984/mcp`,
`-c mcp_servers.cubric-studio.default_tools_approval_mode="approve"`, a draft skill at
`<cwd>/.agents/skills/cubric-studio/SKILL.md` (server name + the `ALL_TOOLS` filter + "never the
browser or the HTTP API"), and the VS Code test's sentence: "Make me an image of a red bicycle in
Cubric Studio, in a new project called Codex cold test. Use a free local model."
- 74 s end to end. Its only shell use: reading the skill (twice, first at a wrong path). Server
  log: `status`, `list_models`, `create_project`, `describe_model`, `read_knowledge`, ONE
  `generate`. No browser, no HTTP scraping. It read the guide first, which Claude Desktop skipped.
- Disk: `Codex cold test/Media/t2i_001.png`, **the only media file**, plus its `.meta` sidecar,
  `project.json`, `project.md`. Opened by eye: a red bicycle on a country lane. Krea 2, free.
- Its reply linked the disk path (phase 2 item 3 working).
So the skill is what makes Codex work, and it belongs in the Codex plugin.

**Phase 3 items 1 and 5 (2026-09-26, session 5bdb59e7, PASSED, auto).** `npx -y @anthropic-ai/mcpb@2.1.2 pack mcp/cubric-studio <out>/cubric-studio.mcpb`
validated the manifest and wrote a 4.0 kB bundle; `zipfile` lists exactly `manifest.json`,
`README.md`, `server/index.js`. The updater patterns (`^Cubric(Vision|Studio)-...-update-v`) cannot
match `cubric-studio.mcpb`, so a 7th asset is safe. Docs: `docs/mcp-server.md` (96 lines), a
`docs/README.md` row, a note in `portable-distribution-contract.md` § Connector Manifest, the pack
step in `mpi-release` step 6 and `github-release-checklist.md`. `node --test tests/mcp.test.cjs
tests/card-view.test.cjs` -> 24/24. Not proven until a real release attaches it.

**Distribution research sources** (2026-09-25; web research by a sub-agent, primary docs
where marked):
- Claude Desktop extensions and submission: claude.com/docs/connectors/building/mcpb and
  claude.com/docs/connectors/building/submission (primary)
- MCP Registry: modelcontextprotocol.io/registry/quickstart and /registry/package-types
  (primary)
- Claude Code plugins: claude.com/docs/plugins/submit (primary)
- Gemini CLI extensions: github.com/google-gemini/gemini-cli docs/extensions (primary)
- Codex MCP: developers.openai.com/codex/mcp (search summary, not fetched)
- ChatGPT local MCP: community.openai.com (search summary, not fetched)

## Rejected, then reopened the same day (2026-09-17)

`3e1997a7` closed this card on "there should be no command-line interface anywhere". That misread
Fabio: he meant **a user never uses a terminal**. An outside agent controlling the installed app is
still wanted, and this card's CLI is something the AGENT runs. Reopened to `todo` / `deferred` with
that rule at the head of the description. The four questions in `brief.md` stay his.

## Step 1: the skill split (2026-09-15, PASSED, auto)

`.claude/skills/cubric-vision/SKILL.md` (721 lines) is now a router plus five on-demand files:

| File | Lines |
|---|---|
| `SKILL.md` (router) | 108 |
| `projects.md` | 116 |
| `on-disk-format.md` | 185 |
| `generating.md` | 135 |
| `flows.md` | 124 |
| `engine-and-remote.md` | 78 |

Sections were cut by line range from `git show HEAD:.claude/skills/cubric-vision/SKILL.md`,
so they moved verbatim. What was rewritten on purpose:
- a two-line header on each new file;
- the router's "Where everything else lives" table;
- § Connector (below);
- six cross-references the split broke, plus three line wraps those fixes left.

**Check:** `python <session scratchpad>/verify_split.py` → `PASS: budget, selector, no text
lost, links, sections, anchors, connector`. The script was not kept, so what it asserts is
written out here:
1. Every file ≤200 lines.
2. Frontmatter lines 1–6 identical to HEAD, so the `description:` selector did not move.
3. Every non-blank HEAD line is present in the six files (multiset count). The only
   exceptions are the rewritten lines, listed by HEAD line number: 49–50, 251–252, 535–536,
   540, 547, 606, and Connector 375–399.
4. Every relative `](x.md)` link resolves.
5. Each cross-referenced section exists in the file named: § Recovering the prompt behind an
   image, § Creating a project, then generating into it, § Dispatching a generation.
6. Both outside anchors now name `cubric-vision/generating.md`:
   `.agents/mpi-kanban/project-knowledge-index.md:174` and
   `docs/playbooks/add-flow/06-preview-image.md:139`.
7. The stale Connector route row and "Capabilities present today" are gone.

**The check bites:** its first run FAILED on three lines. Those were two bugs in the check
itself: an off-by-one line number, and a removed Connector code fence consuming a moved
duplicate's count. Both were fixed and the check re-run. A check that failed for a real
discrepancy is not a check that always passes.

`validate_board.py .` → `Board validation passed.` The session's skill listing re-registered
`cubric-vision` with the description unchanged.

**§ Connector was stale, and is folded in here.** It advertised `POST /connector/enhance` and
the `prompt.enhance` / `system.memory.release` / `system.shutdown` capabilities. MPI-677
step 2 deleted all of them. `routes/connector.js:161-166` now answers
`{ generationSubmit }` only, and the file header lists the surviving routes. The router now
names the three agent routes (`capabilities`, `generate`, `open-project`) and says the two
`jobs` routes are the app window's own relay.

**Not checked:**
- No cold agent was asked to find something through the router.
- The app was not driven; nothing here is runtime.
- `CLAUDE.md:32` was left alone: it names the router path, which is unchanged.

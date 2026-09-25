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

**Not checked:**
- Codex, Gemini / Antigravity.
- A video, a Flow, a paid cloud model.
- The app closed while a client connects: the bridge returns its error, but no client has
  been seen handling that.

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

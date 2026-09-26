# MPI-593 Brief: Cubric Studio as an MCP server

> **Rewritten 2026-09-25: MCP-first.** The 2026-08-21 brief chose a small Node CLI and
> rejected MCP to save tokens. Fabio reversed that on 2026-09-25: the users are not coders,
> and a CLI only reaches agents that can run shell commands. The old brief is in git history
> (`git log -p -- .agents/mpi-kanban/tasks/MPI-593/brief.md`). Step 1 (the skill split) still
> stands; the CLI is dropped.

## Goal

A user with Claude, Codex or Gemini installs Cubric Studio's connector the way they install any
other one, then says "make me an image of X in Cubric Studio" and it just works against the app
they have open. **The user never types a command** (Fabio's rule, 2026-09-17).

## Why MCP, not a CLI

| | CLI + skill | MCP |
|---|---|---|
| Claude Code, Codex, Gemini CLI | yes | yes |
| **Claude Desktop chat** (where non-coders are) | **no**: skills there run in a cloud sandbox and cannot reach the user's PC | **yes**, one-click `.mcpb` extension |
| ChatGPT | no | no: it connects only to remote HTTPS servers |
| Listed in the agent's own directory | no | Claude Desktop Extensions, Claude Code plugins, MCP Registry, Gemini gallery |
| Token cost | pay per use | about 4k tokens for the tool list; Claude Code defers MCP schemas until used |

The original objection counted 137 routes. The real surface is a curated tool set over the
connector routes the in-app agent already uses.

## Shape

```
Claude Code / Codex / Gemini CLI ──HTTP──▶ POST http://127.0.0.1:3000/mcp   (routes/mcp.js)
Claude Desktop ──stdio──▶ .mcpb bridge ──HTTP──┘                             │
                                                                             ▼
                                    services/agentTools.mjs ─▶ /connector/* routes (unchanged)
```

- **The app IS the MCP server** (`routes/mcp.js`): stateless Streamable HTTP, JSON responses,
  no sessions. Every tool is a thin call through `agentTools.mjs`, so there is no second
  dispatch path (`routes/connector.js` header).
- **The `.mcpb` bridge** (`mcp/cubric-studio/`) exists only because Claude Desktop extensions
  speak stdio. It pipes JSON-RPC lines to `/mcp` and holds no tools, so it never changes when
  the tools do. The app's version decides the tools.
- `routes/localOnly.js` (MPI-921) already refuses browsers, which the MCP spec requires
  (Origin validation) for a local HTTP server.

## Distribution (researched 2026-09-25, sources in validation.md)

| Channel | How users install | How we get listed |
|---|---|---|
| Claude Desktop | Settings > Extensions > Browse, or double-click the `.mcpb` | Anthropic's extension submission form. Needs a **privacy policy URL** (missing = rejected), tool titles and annotations. Free, reviewed. |
| Claude Code | `/plugin install`, or `claude mcp add --transport http cubric-studio http://127.0.0.1:3000/mcp` | Plugin in a public repo, submitted to the official marketplace. A plugin can carry the MCP URL plus a skill. |
| MCP Registry | Clients that read it (VS Code, GitHub, aggregators) | `mcp-publisher`, `server.json`, the `.mcpb` as a GitHub release asset. Automated, no human review. |
| Antigravity (replaced Gemini CLI, which Google stopped serving to personal logins on 2026-06-18) | copy the plugin folder into `~/.gemini/config/plugins/` | `plugin.json` + `mcp_config.json` (`serverUrl`) beside the Claude files, same skill. No public gallery found yet |
| Codex | `codex plugin marketplace add <repo>`, then `codex plugin add` | A plugin (skill + `.mcp.json`) in the same public repo. A bare `codex mcp add` is NOT enough: Codex defers MCP tools and drops our `instructions`, so without the skill the model never finds them (2026-09-26, `validation.md`). |
| Smithery, Glama, PulseMCP | Browsing | They index the registry and GitHub on their own |

## Phases

1. **Spike: DONE 2026-09-25.** The endpoint, the bridge, 8 tools, a cold Claude Code agent
   making an image unaided. Found and fixed the one real bug (the 60 s client timeout).
2. **Safe for users.** Everything a stranger's agent must not be able to get wrong. See
   plan.md.
3. **Ship and list.** The `.mcpb` on each GitHub release, the directories above, a Settings
   page that tells users how to connect, docs.

## Decisions (Fabio, 2026-09-25)

1. **Spending: the agent shows the price first.** "A bad generation can cost $4." DONE in
   `routes/mcp.js` `spendGate`: a billed run answers `CONFIRM_COST` with the quoted price and
   generates nothing until the call repeats that price in `confirmCost`.
2. **Privacy policy: none exists, so write one.** The Claude Desktop directory needs an HTTPS
   URL. Its home is the Website repo (cubric.studio); publishing it is Fabio's call.
3. **Listings: one public repo** holding the Claude Code plugin (also Codex's and Antigravity's) and the
   registry entry. Creating it is outward-facing, so it waits for phase 3 and a go-ahead.

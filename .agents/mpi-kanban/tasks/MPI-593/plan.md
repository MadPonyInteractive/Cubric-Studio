# MPI-593 Plan: MCP-first (rewritten 2026-09-25)

Source: `brief.md`. Step 1 of the old plan (the cubric-vision skill split) shipped 2026-09-15
and stays; its record is in `validation.md`. The CLI (old steps 2 and 3) is dropped.

## Current State

**Phase 1 spike is DONE and verified (2026-09-25).** Files: `routes/mcp.js`, one mount line in
`server.js`, `mcp/cubric-studio/` (manifest + bridge), `tests/mcp.test.cjs` (10/10). Evidence
in `validation.md`. **Next: Fabio installs the `.mcpb` in Claude Desktop against his own app
(needs a full quit and relaunch to load the new route), and answers the three questions at the
bottom of `brief.md`. Phase 2 starts from his answers.**

## Phase 1: spike (DONE)

- `POST /mcp`: stateless Streamable HTTP. Methods: `initialize` (echoes a supported protocol
  version and sends `instructions`), `ping`, `tools/list`, `tools/call`. Notifications get 202.
  GET and DELETE get 405.
- Tools: `status`, `list_models` (the in-app `compactCatalogue`), `describe_model`
  (`catalogueEntry`), `list_projects`, `create_project` (opens it), `open_project`,
  `generate`, `wait_generation`.
- `generate` answers within 45 s. A slower job returns `{ running: true, jobId }`, and
  `wait_generation` waits another 45 s each call. The cold test caught this: most MCP clients
  give a tool call 60 s, a 73 s render read as a failure, and the agent ran it again.
- The bridge is `node:http`, not fetch, for the same 300 s reason as `agentTools._post`.

## Phase 2: safe for users (before any release)

Ownership when picked up: `routes/mcp.js`, `mcp/**`, `tests/mcp.test.cjs`. The routes in
`routes/connector.js` and the in-app agent's files are live ground for MPI-916 and MPI-774.
A change there goes through a message to that session, never a direct edit.

1. **The cost check** (brief Q1). A paid op must show its price before it runs.
2. **Reference images.** An agent passes a file path on the user's disk. The MCP layer stages
   it into the project (`place-preview-asset`) and sends `media: [{role, url}]`. This unlocks
   edit, i2i and i2v.
3. **Results the agent can use.** Return a disk path, not a `/project-file?path=` URL, plus a
   small image (MCP `image` content) so the agent can see what it made. Cold test 2 said it
   "couldn't open the file myself, so I haven't seen it".
4. **The rest of the tool set**, each a thin route call: `list_cards`, `rename_card`,
   `read_knowledge` (model guides), `cancel_generation`, the GIF tools. Never `install_model`
   without a size warning, and never anything that deletes.
5. **App closed when the client starts.** Today every call fails with "Cubric Studio is not
   running", and a client that started first has no tools until it reconnects. Decide whether
   the bridge answers `initialize` itself and sends `tools/list_changed` once the app is up.
6. Tool `title` fields and annotations throughout, which the Claude Desktop directory requires.
7. Run the cold test on Codex and Claude Desktop as well as Claude Code.

## Phase 3: ship and list

1. Build the `.mcpb` in the release flow and attach it to each GitHub release (`mpi-release`).
2. Settings > "Connect an agent": per-client instructions to copy, and the `.mcpb` download.
   UI work, a separate card.
3. Listings: Claude Desktop extension submission, the MCP Registry (`mcp-publisher`), a Claude
   Code plugin (MCP URL + slim skill), a Gemini CLI extension. Repo home per brief Q3.
4. Docs: a docs-site page, and `llms.txt`. That repo is a hard no-push, so Fabio commits it.
5. `docs/`: record `/mcp` in the connector subsystem doc and the portable distribution contract.

## Verification

Per phase: `node --test tests/mcp.test.cjs` green, then the cold test. The cold test is a
client with no Cubric context, one sentence, on an isolated instance (`npm run app:isolated`
with `APP_DOCUMENTS` pointed at a scratch folder so no real project is touched). **The proof
is the file on disk and how many files landed, never the agent's report.**

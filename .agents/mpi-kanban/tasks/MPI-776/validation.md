# MPI-776 validation

## Unit

`npm test`: 1077 tests, 1076 pass, 0 fail, 1 skipped (2026-09-15). New in
`tests/agent-generation-relay.test.cjs`, all passing:

- `rename-card relays card.rename; a null name reaches the renderer to clear it`
- `rename-card refuses a missing groupId or name before relaying anything`
- `generate relays cardName on both branches and refuses a non-string one`

`node --check` clean on `routes/connector.js`, and on `agentDispatch.js`,
`projectService.js` and `MpiGalleryBlock.js` as ES modules.

## Live, on an isolated instance

`app:isolated` with a fresh `CUBRIC_AGENT_PROFILE` and an empty scratch
`CUBRIC_ENGINE_ROOT` (no repair, no download in the log), port 49225. The project was a
scratch copy of a 2-card project with every absolute and URL-encoded path rewritten
(zero leaks back to the original). A playwright page on the instance was the newest relay
subscriber, so the jobs ran in a renderer whose DOM could be read.

| Step | Result |
|---|---|
| `open-project` | `ok`, `groupCount: 2`; page state `currentPage: gallery` |
| `rename-card` `{groupId, name: "  Rider at dusk  "}` | `ok`, `cardName: "Rider at dusk"` (trimmed) |
| `project.json` after | `t2i_001` carries `customName: "Rider at dusk"` |
| card label in the DOM | `Rider at dusk`, with no reload |
| bogus `groupId` | `NO_SUCH_CARD`, message names the open project |
| body with no `name` | `400 BAD_REQUEST` |
| `name: null` | `ok`, `cardName: null`, `displayName: "t2i_001"`; disk `customName: null`; DOM `t2i_001` |

**Negative control.** With only `grid.el.refreshGroup(group)` removed from the new
`project:group-updated` listener and the page reloaded, a rename still wrote
`customName: "Negative control"` to disk while the card label stayed `t2i_001`. So the
listener is what repaints; nothing else did. Restored from a byte copy, `cmp` identical.

## Not verified live

`cardName` on `/connector/generate` needs a real generation, and the sandbox had no
engine or weights. The route half is unit-tested on both branches; the renderer half is
`_reportDone` calling the same `renameGroup` proven above.

## Skill family

`cubric-vision` (core) plus `cubric-vision-generate`, `cubric-vision-flows`,
`cubric-vision-project-files`, `cubric-vision-engine`. All five were picked up by the
skill list in-session with full descriptions (933, 757, 650, 735, 557 characters; the
old single description was 1617 and was cut mid-word). No reference to the four removed
files remains outside `.agents/` history. MadPony-Identity's TTS playbook pointer
updated there, commit `720db52`.

## Shared tree

`routes/connector.js`, `js/shell/agentDispatch.js` and the generate skill (formerly
`cubric-vision/generating.md`) also carry MPI-774's uncommitted Batch 1 work. They were
committed as HEAD-based blobs holding MPI-776 only; MPI-774's hunks, including its
`## Agent tool routes (MPI-774)` section now in `cubric-vision-generate/SKILL.md`, stay
uncommitted in the worktree. MPI-774 was messaged.

## Left for others

- In-app agent `rename_card` tool: `services/agentTools.mjs` / `docs/agent-chat.md` are
  MPI-774's.
- The group-history breadcrumb does not repaint on an outside rename; it rereads on
  navigation.
- `.claude/rules/component-events-blocks.md` does not yet list the gallery block's new
  `project:group-updated` listener; rule files change only with explicit permission, asked
  at close-out.

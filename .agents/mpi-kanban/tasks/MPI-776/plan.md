# MPI-776 - agents name gallery cards; the cubric-vision skill becomes a family

## Why

An agent in another repo, generating with a user, could not rename cards. Referring to
"001" and "008" is error-prone; a card name the agent and the user both see fixes that.
The skill only said a gallery rename sets `customName`. It gave no way to do it and no
warning that a write straight to `project.json` gets overwritten.

**Root cause of the overwrite.** While a project is open, the renderer owns its
`itemGroups`. `projectService.persistGroups` posts the WHOLE array to `/update-project`
on every group mutation (a favourite, a finished generation), so any hand edit to
`project.json` is replaced by the renderer's copy on the next save. A rename has to go
through the renderer, exactly like `/connector/open-project` does.

**Second gap found while reading.** The gallery block never listens to
`project:group-updated`. The inline rename paints its own label, so nobody noticed, but
a rename from anywhere else would persist and not repaint. The grid render key carries
`name`, not `customName`, so a `setGroups` diff would not catch it either.

## Shape

- `POST /connector/rename-card { groupId, name }` relays capability `card.rename`.
  `name` trimmed; blank or null clears it and the derived name shows again, same as the
  gallery's inline rename. Errors: `BAD_REQUEST`, `NO_PROJECT`, `NO_SUCH_CARD`,
  `APP_UNAVAILABLE`.
- `projectService.renameGroup(groupId, customName)`: looks the group up INSIDE the
  mutation queue (a snapshot taken outside it can be stale by the time it applies),
  persists, emits `project:group-updated`. Returns null when the card is not in the open
  project.
- `MpiGalleryBlock` listens to `project:group-updated` and calls `grid.el.refreshGroup`,
  the same repaint `gallery:item-updated` already uses.
- `/connector/generate` accepts `cardName` on both the model and Flow branches, applied
  through `renameGroup` in `onComplete` (the gallery path awaits `addGroup` before it
  calls back, so the card is in state). Non-string is `INVALID_CARD_NAME`.
- Skill split, one skill per current file: `cubric-vision` (core: connection,
  whole-prompts rule, connector table, projects, media, cards) plus
  `cubric-vision-generate`, `cubric-vision-flows`, `cubric-vision-project-files`,
  `cubric-vision-engine`. The core folder keeps its name: `CLAUDE.md` and two docs cite it
  as an identifier (MPI-708 audit). The old description was 1617 characters, past the
  1024 skill limit, and the skill list already truncated it mid-word.

## Shared tree

`routes/connector.js`, `js/shell/agentDispatch.js` and `cubric-vision/generating.md` hold
MPI-774's uncommitted Batch 1 work. Those three commit as hand-built index blobs (HEAD
plus MPI-776 only); MPI-774 was messaged. Its generating.md section moves, uncommitted,
into `cubric-vision-generate/SKILL.md`.

## Not in scope

- The in-app agent's `rename_card` tool: `services/agentTools.mjs` and
  `docs/agent-chat.md` belong to MPI-774, told by message.
- The group-history breadcrumb label does not repaint on an outside rename; it rereads on
  navigation.

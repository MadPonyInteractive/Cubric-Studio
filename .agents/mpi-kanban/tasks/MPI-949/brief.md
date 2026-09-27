# MPI-949 Brief - Gallery stacks replace Cue all

Design agreed with Fabio in a brainstorm, 2026-09-27. Nothing built yet.

## Why

Cue all (MPI-733, bar button MPI-945) fails two ways:

1. It is blind. Selecting hides the PromptBox, so the `not-batchable` reason ("Cue all does not
   support the current operation", `MpiGalleryGrid.js`) names an op the user cannot see.
2. It reaches PromptBox ops only. History-rail tools (Resize, Upscale, Remove BG, video
   Upscale/Interpolate) can never run over many cards, and the selection is gone after one run.

## The stack card (approach A - a container of existing cards)

- A stack is a `project.json` card: `type: 'stack'`, `kind: 'image' | 'video'`,
  `members: [cardId, ...]` in click order. Each member gets `stackId`; the grid skips cards with
  one. Members stay real cards - history and sidecars untouched. No new history data shape.
  (Rejected: B, a card whose history entries hold N files - every consumer assumes one entry =
  one file. C, fixing Cue all in place - re-grows a prompt box on the bar, no persistence.)
- Create: select cards, **Stack** on the selection bar (Cue all's slot). Disabled, with the
  reason on the status bar, for: mixed image+video, a stack in the selection, audio or GIF
  cards, a single card. The stack takes the grid position of the first-clicked card.
- Look: thumbnail = first member's current version, a layers badge with the count, offset card
  edges behind it.
- Card right-click menu: **Unstack** (members return at the stack's position, in stack order,
  stack card removed - no selection needed), **Delete** (asks: Unstack and keep / Delete all N),
  plus rename, marks, Archive, Download (all members).
- Out of v1: drag a card onto a stack to add it; stacks inside stacks.

## Gallery run (results = a NEW stack)

- Drag the stack onto the PromptBox: ONE chip, layers badge + count. The op strip gates it like
  one image/video of the stack's kind, so the op is visible before running.
- Only ops with exactly one required input accept it - `selectCueAllTargets` rule, reused
  as-is. Other ops grey out with a plain reason. One stack chip per box; other chips ride along
  on every job (e.g. a reference image for Klein Edit - consistent results across a series).
- Run = N jobs, one per member, via `buildCueAllJobItems` unchanged. ONE queue entry
  ("Klein Edit 4/10") with cancel-all. Refuses while Loop is armed.
- Result: a new stack "<source name> · <op>" appears beside the source at Run and fills as
  jobs finish (badge counts up). Cancel/failure keeps what finished; status line says how many
  are missing.
- Cue all removed: bar button, `cue-all` event, `_cueAllDispatch`. The two pure functions and
  their tests stay, now serving stacks.

## Stack History workspace (results = a NEW VERSION on each member)

Layout:
- Viewer: the selected member at its current version.
- Member strip under the viewer (GIF frame-strip style): each member's current version; a dot
  on members whose crop box was moved; click selects; ctrl-click picks members for Apply.
  Right-click: **Remove from stack** (card back to gallery), **Delete** (with confirm).
- Right panel: **◀ Version ▶** stepper (moves EVERY member's current version one step; a member
  with no earlier/later version stays put), then the selected member's own `MpiHistoryList` -
  pick a version, delete a version, exactly as on a single card.

Tools ALWAYS run on each member's current version. Apply runs on the ctrl-picked strip members,
or on all members when none are picked.

| Image tool | In a stack |
|---|---|
| Prompt | Run adds a version to each member |
| Crop | `ratio` type only. Shared ratio; each member starts with the largest centred box and can be dragged per member. Divisible-by and Fill Outside kept. No free / resolution type |
| Resize | Long edge or % only (exact W×H would squash mixed ratios) |
| Upscale | Unchanged |
| Remove BG | Unchanged |

Hidden: Paint, Mask, Composite, Place. Video: Prompt, Resize, Upscale, Interpolate (video crop
is a separate code path - add later).

GPU tools (Upscale, Remove BG, Prompt runs) = one queue entry with cancel-all. Crop and Resize
are fast server-side sharp jobs = direct loop with a progress line, no queue.

## Undo = the per-member history (no log, no undo system)

| Need | How |
|---|---|
| Every member back one step | ◀ Version ▶ |
| Fix one member | Pick a version in its history list |
| Delete a bad version | Right-click it in the member's history |
| Re-run on some members | Ctrl-pick in the strip, Apply |
| Drop a member | Strip right-click, Remove from stack |

## Agents

v1: dragging a stack onto the agent composer sends its members exactly like today's dragged
multi-selection (MPI-948 "N cards" set). Stacks-as-stacks for the in-app agent and MCP is
MPI-950, held behind MPI-941's claims on `services/agentLoop.mjs` / `routes/agent.js`.

## Parked idea (not v1)

SAM3 text mask per member ("fox") then a masked edit - same shared-param + per-member-fix shape
as crop. Only worth it if an unmasked edit bleeds (recolours the tiger too). The GIF workaround
is worse: Make GIF caps frames at a 1024 max edge.

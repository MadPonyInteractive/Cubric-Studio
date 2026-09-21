# MPI-867 brief

Two faults, ONE surface: how media gets into the agent panel's composer. Fabio reported
the second one on 2026-09-21, after MPI-797 closed, and it is not a separate card — the
payload that fixes the drop routing is the same payload that carries a clip by reference.

## Fault 1 — a clip cannot be handed to the agent at all (the card's original scope)

See `task.json` and the `todo` gate in `tests/agent-video-attachment.test.cjs`.
`MpiAgentChat._addImageFile` guards on `image/` and silently drops a clip.

## Fault 2 — a card dragged onto the agent panel lands in the PROMPT BOX

Fabio, 2026-09-21: "When the user drags something into the agent box, it should not be
dragged into the prompt box, and that's what's happening."

Diagnosed, not guessed:

- `MpiPromptBox.js:610` listens on **`window`**, not on its own element:
  `if (!_isMediaDrag(e) || el.contains(e.target)) return;`
  The agent panel is not inside the prompt box's `el`, so the guard does not exclude it
  and the window handler claims the drop. The comment above it states the intent plainly
  — "make the WHOLE window the drop target for a media drag ... drop anywhere = attach to
  prompt". That was TRUE when the prompt box was the app's only drop zone. MPI-797
  Phase 2 gave the panel a composer of its own and made it false.
- `MpiAgentChat.js:649` reads only `e.dataTransfer.files`. A gallery-card drag carries no
  files — it carries `application/mpi-media` holding `{ filePath, type, name }`. So the
  panel's own handler finds nothing, does nothing, does not stop propagation, and the
  prompt box takes it.

Why it only bites on CARD drags: an external file drag has `types` of `Files`, so
`_isMediaDrag` is false and the window handler returns early. Dropping a real file on the
panel already works (images only). Dropping a gallery card does not.

## Why this makes the card EASIER, not bigger

The card's open design question was "a clip can only travel by reference once it is a file
the open project already holds — so how does the composer get there: a shared import
service, a card picker, or both?"

A gallery card drag ALREADY carries `{ filePath, type, name }` by reference, for a file the
project already owns. That is the answer to the by-reference half for every card in the
gallery, with no import service and no picker — it is a payload the panel is simply not
reading yet. A dropped *external* file still needs staging, and that part of the question
stands.

## Definition of done (unchanged, plus the routing)

1. The `todo` gate in `tests/agent-video-attachment.test.cjs` passes: the panel produces
   `{ url, name, mediaType: 'video', itemId }` — by reference, never a base64 data URL.
2. A gallery card dropped on the agent panel attaches to the AGENT, and the prompt box
   does not see it. Decide the mechanism: exclude the panel in the prompt box's window
   guard, or have the panel handle `application/mpi-media` and stop propagation. Prefer
   whichever keeps ONE owner of the rule rather than two guards that can drift.
3. Fabio drops a clip and a card on the panel and the agent can act on both (verify mode
   is `user-ux`).

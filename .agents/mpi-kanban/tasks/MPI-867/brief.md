# MPI-867 brief

Rewritten 2026-09-26 with Fabio. Supersedes the 2026-09-21 brief (kept in git history).

## The principle (Fabio, 2026-09-26)

**The agent receives the CARD, never its pixels.** Handing Cosmo a card says *which card I
mean*: "restyle this", "use this clip as the reference for a video". Most jobs never need
the agent to see the media, so it does not. It looks only when the task needs it, through
`look`. The THUMBNAIL is feedback for the USER only: the composer chip and the chat
bubble show what was sent.

The server side already works this way. `routes/agent.js` stages a by-reference
attachment with no copy (`ownedMedia`, open project only). `agentLoop.mjs` ~2081 registers
it as a ref and gives the model ONE text line (name, ref, size, groupId). The model
receives text only, never image bytes. What is missing is all UI side.

## Fault 1: a video card reaches the agent as its thumbnail

`MpiAgentChat._addCardMedia` asks `cardAttachmentSource()` (`js/utils/mediaActions.js:67`),
which returns null for anything but an image. The drop then falls back to
`dataTransfer.files`, which for a card is Chromium's dragged `<img>`: the 512
`.thumb.webp`. It is staged as a COPY and a still. The live "gecko climb" case ran
`minimax-h3:i2v_ms` on that still.

Fix: with a project open, a video card goes by reference like an image card already does:
`{ url, name, mediaType: 'video', itemId, groupId }`. This is the shape the `todo` gate
in `tests/agent-video-attachment.test.cjs:123` asserts. The loop's video line should
match the image line: add groupId to `_groups`, point to `list_cards`, and give the
chat bubble a `url` so the user sees what they sent. That url must be the card's STILL,
because an `<img>` cannot paint an mp4.

## Fault 2: a drop on the agent panel also lands in the prompt box

`MpiPromptBox.js` ~641 listens on `window` and takes every `application/mpi-media` drop
outside its own element ("drop anywhere = attach to prompt"). The panel handles the drop
but never stops it, so it bubbles on to the window and the prompt box takes it too. That
is the "Media type not supported for this model" toast. The app's convention is that a
drop target stops propagation once it has handled the drop (`MpiGalleryBlock.js` ~272),
so the panel should do the same. One owner, no second guard.

## Fault 3: a file dropped from the OS (Fabio, 2026-09-26)

**A file dragged in from the file system becomes a gallery card FIRST, and only then goes
to the agent**, by reference like any card. The machinery exists:
`uploadMediaFile` (`js/services/mediaUploadService.js:40`) writes the media and its
sidecar, and `Events.emit('media:imported', ...)` makes `mediaImportService.js:102` build
the card. `MpiPromptBox._importMediaFile` is the one caller today; reuse the same service,
never a copy of the function. This covers images AND clips, so it answers the old "a
clip needs a shared import service" question.

Open for the plan: with NO project open (the landing chat), there is nowhere to make a
card. Today an image dropped there is copied as a staged attachment. Decide whether that
stays or the drop asks for a project first.

## Out of scope, separate line

Letting `look` SEE a clip (a contact sheet via `services/cardView.js`) is message
a082a6a6 from MCP3 (session 9e0c3d22). It is a capability for when the agent chooses to
look, not part of handing over a card. Take it after `cardView.js` is committed.

## Definition of done

1. The `todo` gate in `tests/agent-video-attachment.test.cjs` passes (remove the `todo`).
2. A card dropped on the agent panel attaches to the agent only. The prompt box does not
   see it (no toast).
3. A file dropped from the OS lands as a gallery card and is sent by reference.
4. The chip and the chat bubble show a thumbnail for images and clips alike.
5. Verify mode `user-ux`: Fabio drops a video card, an image card and an OS file on the
   panel, then asks for something that needs no look, and the agent acts on the right card.

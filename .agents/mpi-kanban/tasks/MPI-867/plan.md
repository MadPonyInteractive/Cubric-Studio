# MPI-867 plan — the agent gets the card, never its pixels

Brief: `brief.md`. Fabio approved 2026-09-26, and added: with no project open, a dropped
file asks the user to open or create a project first. The landing chat never copies.

## Steps

1. **`js/utils/mediaActions.js`**: `cardAttachmentSource` becomes `cardReference(payload)`.
   An image or video card whose filePath is a project file (not blob/data/empty) and has a
   groupId returns `{ url, name, mediaType, itemId, groupId, thumb }`. GIF cards are
   included now, because nothing is staged. Audio returns null. The STAGEABLE_STILL
   restriction goes: it existed only for the staging copy.
2. **`MpiGalleryGrid.js` dragstart**: the payload carries `thumbPath`, so a video chip has a
   still to show.
3. **`MpiAgentChat.js` drop**:
   - A card payload goes by reference or not at all; it never falls through to
     `dataTransfer.files`, which is the dragged thumbnail.
   - An OS file (image/video) goes through `uploadMediaFile`, then `media:imported` with a
     groupId the chat picks, then by reference.
   - No project: a `ui:info` toast asks the user to open or create one.
   - `stopPropagation()` so the prompt box's window listener never sees the drop.
   - Chips and bubbles draw `thumb || url`. `_addImageFile` goes (it is orphaned).
4. **`mediaImportService.js`**: `_buildGroup` honours an optional `groupId` (document it in
   `js/events.js`).
5. **`services/agentLoop.mjs`** video branch: mirror the image line. Add the groupId to
   `_groups`, point to list_cards, and give the bubble a thumb url
   (`<dir>/.meta/<itemId>.thumb.webp` when it exists).
6. **Tests**: rewrite `tests/agent-attachment-full-res.test.cjs` for `cardReference`. The
   `todo` gate in `tests/agent-video-attachment.test.cjs` becomes a real test.

## Verification

- `node --test tests/agent-attachment-full-res.test.cjs tests/agent-video-attachment.test.cjs`
- `npm run lint` on the touched files
- **Verify mode:** user-ux. In `npm run app:isolated`, drop a video card, an image card and
  an OS file on the panel; confirm no prompt-box toast and a thumbnail chip for each; ask
  for something that needs no look.

## Current State

2026-09-26 (handoff): steps 1-6 plus fold-in (a) are committed. Fabio verified the image
card drop, the OS-file drop (it lands as a card) and that the prompt box no longer takes the
drop. The landing-page drop is accepted as gallery-only. NEXT: (1) Fabio re-checks the video
chip after a reload (fix: `_posterOf` in mediaActions.js). (2) Fabio decides the Model-rule
wording (fold-in b, see Plan Drift). Proposed: a look a model is BUILT to paint goes to that
model's i2i; a look no installed model paints (3D, clay, watercolour) goes to the edit task.
Then close out with mpi-end-session.
Not done: while you drag a card over the agent panel, the prompt box still shows its "armed"
highlight (its window dragenter). This is cosmetic only, because the drop no longer reaches it.

## Completed

Steps 1-6, plus the docs (agent-chat.md, gallery.md).

## Remaining Work

User-ux check only.

## Plan Drift

- 2026-09-26, folded in by Fabio: (a) the agent claimed denoise 0.65/0.85 that it never
  sent (the log says `denoise=0.3 (defaulted)` on all five i2i runs). DONE: `_sentNote` in
  agentLoop.mjs echoes the sent settings on generate's result; test in
  agent-loop.test.cjs. (b) "Convert this to 3D" went to i2i per the Model rule. That rule
  exists because on 2026-09-21 "make this anime" on Klein edit dressed the subject
  (tests/model-priority.test.cjs:59). PENDING Fabio's call on the wording.

- 2026-09-26: `tests/agent-card-reference.test.cjs` pinned the old "the landing chat copies"
  rule. Rewritten for Fabio's new rule: ask for a project, never copy.

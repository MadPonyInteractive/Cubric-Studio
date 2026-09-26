# MPI-867 validation

## Automated (2026-09-26) - PASSED

- `node --test tests/agent*.test.cjs tests/media*.test.cjs` -> 312 tests, 311 pass, 0 fail, 0 todo.
  The former `todo` gate in `tests/agent-video-attachment.test.cjs` is now a real test and passes.
- `npx eslint` on the six touched source files -> clean.

## Fabio's run (2026-09-26)

- Image card, OS file (imported_001 landed as a card + chip), no prompt-box toast: WORKED.
- Video card chip: BROKEN, alt text only. The grid has TWO dragstarts, and the poster `<img>` one
  (~1362) sets no `thumbPath`. Fixed in `cardReference`: it derives
  `Media/.meta/<itemId>.thumb.webp` (the server's convention) when the payload lacks it. Test
  added; 13/13 pass. Needs a reload to re-check.
- Landing page: the project-drop overlay covers the whole window, so the panel never receives
  a file there. Fabio: fine, dropping only works in the gallery. The `_needProject` toast stays as
  a guard.
- Mascot heads-up on retries: correct by design (a redo = a failed attempt). Unchanged.

## User-UX - PENDING (Fabio): re-check the video chip after reload

Needs an app restart (renderer + server code changed). In a project:
1. Drag a VIDEO card onto the agent panel: a poster chip appears, and the prompt box shows no
   "Media type not supported" toast.
2. Drag an IMAGE card: a chip appears, and the prompt box does not take it.
3. Drag a file from Explorer: it lands as a new gallery card AND as a chip.
4. Send "use this clip as the reference for a video of a cat" (no look needed): the agent names
   the right card, and the sent bubble shows the poster.
5. On the landing page, drop a file on the agent: a toast asks you to open or create a project.

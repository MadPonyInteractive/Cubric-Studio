# MPI-827 Plan — a flow run gets its Gallery placeholder

Root cause and evidence are in `brief.md` and were confirmed by reading the code —
not re-derived. This file is the implementation shape.

## Current State

Code complete and self-verified; WAITING ON FABIO'S APP CHECK (verify mode is
user-ux) - the brief asks for a real agent-dispatched run, which no harness can
stand in for. Evidence: validation.md. Implemented after MPI-822 (both touch `flowService.js`; they were run
sequentially, never as a batch). Session `d1861e83`, claim `b89bab94`.

## Confirmed while reading (the brief's two open questions, answered)

- **Always, not "only when no overlay is live".** Fabio's own recommendation on the
  card, and the reason holds: the result commits to the gallery on completion
  regardless, so the placeholder is simply where that card is going to be. MPI-306's
  "a second in-progress card is noise" premise died twice — the Apply step was
  removed, and an agent-dispatched flow has no overlay at all.
- **Two legs need no special case.** A committed card takes a real group id from the
  media commit, never the `tempId` (`generationService.js` — the tempId only travels
  so the gallery knows which placeholder to tear down). So leg 2 rebuilding a
  placeholder under leg 1's reused tempId cannot collide with leg 1's landed card.
  `_placeholdersForFirst()` reads the group off the live `activeGenerations` entry,
  so it picks up leg 2's automatically.

## Shape

One `placeholderGroup` built in `submitFlowGeneration` and passed in `opts` — the
same shape `agentDispatch.js:285` already builds for a model gen. Nothing in
`MpiGalleryBlock` changes: every other step of that path was already wired and only
had no group to mount.

Dimensions come from the flow's own `injectionParams` when it injects them, and fall
back to 1024 — the same fallback the Continue-branch placeholder uses
(`MpiGalleryBlock.js:731`). A flow that injects no size is not a card with no size;
it is a card whose size the graph decides, and the placeholder is replaced by the
real item either way.

## Verification

**Verify mode:** user-ux

Unit: a source contract pinning that the opts carry a `placeholderGroup`.
Real check (Fabio's, the one that matters): run a flow from the AGENT while standing
in the Gallery and watch the latents paint on the placeholder card.

## Remaining Work

See `checklist.md`.

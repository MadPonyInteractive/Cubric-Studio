# MPI-870 Checklist

Derived from `plan.md` on 2026-09-21. Order is the one Fabio set in the handoff:
the three folded-in honesty fixes first, then the wake, then the batch.

## Folded-in honesty fixes

- [x] A cache read says "Fetching saved image description", not "Looking at image"
- [x] One truncated log line per look (cached vs fresh, the ref, the text)
- [x] A named param records asked vs defaulted

## Wake (the ending)

- [x] `agent:drained` emitted when `_inflight` drains, at the END of `settle`
- [x] `POST /agent/wake` + `AgentSessions.wake()` — idle-only, notes-only, streak-capped
- [x] The wake turn carries no `open_project` / `create_project`
- [x] Renderer posts the wake for the OPEN project, on drain and on project open

## Batch (the ask)

- [x] `cards: [ref...]` on `generate`, fanned out over the single-dispatch path
- [x] Confirm card above 5 cards
- [x] No auto-look on batch items
- [x] Rule 6 answered: `gallery.visible` already refuses with `GALLERY_NOT_OPEN` off the
      gallery (`agentDispatch._visibleCards`) — nothing to build

## Close

- [x] `npm test` green — 1704/1707; the one failure is a live peer's (`seedream-45-cloud`
      preview art, their claim `02c4c0ba`), plus MPI-867's deliberate `todo`
- [x] `npm run lint` clean
- [ ] Live in Fabio's own app after a restart (verify mode is `user-ux`)

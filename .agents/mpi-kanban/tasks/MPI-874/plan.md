# MPI-874 — plan (compact)

## Current State

The brief's premise is false, established 2026-09-26 (session b5b35494). The Flow path names
its card: the gallery completion awaits `addGroup` and hands `_reportDone` the group (a Flow
never sets `deferCommit`, the one branch that skips the write), and a
closed project is named by `nameCard`'s server write (MPI-873). What dropped the names on
2026-09-21 was **Add to project**: the five unnamed cards in "Deepinfra model tests" are
COPIES, and `add-from-cards` hard-codes `customName: null`. Evidence in `validation.md`.

Fabio's call (2026-09-26): repurpose the card to the copy bug (A), pin `nameCard`'s open
branch with a test (B), and prove a Flow `cardName` into a CLOSED project live (C).

**A, B and C are DONE and verified (2026-09-26, `validation.md`).** Nothing is committed
yet. Next: close-out. The code commit goes first; the done move is a separate push once CI
is green on it. The isolated instance from C (:63451, parent PID 35252) may still be running:
auto mode refused the kill, so it was left for Fabio.

## Ownership

- `js/components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js` — send the card's name
- `routes/projects.js` — `add-from-cards` keeps it
- `tests/project-copy-item.test.cjs` — the copy keeps its name
- `tests/agent-target-project.test.cjs` — `nameCard` in the open project

## Remaining Work

1. A: the gallery sends `customName` with each card; the route writes it. Test.
2. B: `nameCard` names a card in the open project through `renameGroup`, no server write.
3. C: one live Flow with `cardName` + `folderPath` of a closed project on `app:isolated`,
   under the GPU lease; `list_cards` on that project shows the name.

## Verification

**Verify mode:** auto

- `node --test tests/project-copy-item.test.cjs tests/agent-target-project.test.cjs`
- full suite `npm test`, 0 fail
- the live run in C

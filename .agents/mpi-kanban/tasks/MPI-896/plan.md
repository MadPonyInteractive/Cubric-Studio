# MPI-896 Plan - Feedback surface

> **Umbrella created by `/mpi-project-refresh` on 2026-09-22 (MPI-893).** These cards were
> already on the board and stay there; this card is the shared context and the running
> order, not a replacement. Nothing here has been re-scoped - read each member's own card
> before touching its files.

## Members

| Card | Title | State |
|---|---|---|
| MPI-516 | A destroyed prompt hangs the app forever - no error, no toast, no log | `todo` / `planned` |
| MPI-569 | Enhance on an exempt operation with an empty prompt shows the wrong toast | `todo` / `planned` |
| MPI-543 | Notification history - a button showing the last five toasts | `todo` / `idea` |
| MPI-302 | Generation ETA in StatusBar (global percent-derived, both engines) | `todo` / `planned` |

## Why these belong together

Four cards, one subject: **what the app says back**. Two are silent failures and two are
missing affordances, and they all land in the same place - `docs/toasts.md`, the `ui:*`
events, `StatusBar.notify` and `notificationService`.

They are grouped because the bugs must be fixed BEFORE the affordances, and doing them
separately gets that order wrong. A notification history (MPI-543) that faithfully records
the wrong toast (MPI-569), or records nothing at all because the prompt died silently
(MPI-516), is worse than no history - it makes a bug look like a design.

## Phases

1. **MPI-516 first - it is the severe one.** A destroyed prompt hangs the app forever with
   no error, no toast and no log. Nothing else in this umbrella is worth building over a
   path that can go silent. **Verify:** a deliberately destroyed prompt produces a
   user-visible failure AND a line in `app.log`. Root cause, not a timeout at the
   crash site - CARDINAL RULE 4.
2. **MPI-569 next.** Enhance on an exempt operation with an empty prompt shows the WRONG
   toast. **Verify:** the exempt path is asserted to raise its own message.
3. **MPI-543 and MPI-302 in parallel** once the messages are correct.

## Parallel Batch

Phase 3 only.

- **MPI-543** - notification history, a button showing the last five toasts. Owns the new
  component + its `.css`, reads `notificationService`.
- **MPI-302** - generation ETA in the StatusBar, global percent-derived, **both engines**.
  Owns the StatusBar ETA path.

Both touch `docs/toasts.md`; agree the split in a message before either writes it.

## Traps already known

- Every UI element is a component - `ComponentFactory.create()`, BEM, no bare `<button>`.
- Completion notifications COALESCE (`docs/generation-lifecycle.md`); a history that lists
  each coalesced part separately contradicts the toast the user saw.
- No toast on a user stop - that is settled, not a gap.
- Both engines means local AND Pod. An ETA correct only on one is not done.

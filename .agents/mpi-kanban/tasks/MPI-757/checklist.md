# MPI-757 — checklist

The umbrella's members, by their **verified board state** on 2026-09-21. This file was written
late (the card had none, which is why `task_ops` refused to move it out of `todo`) — so it lists
what can be checked against the board and the commits, not a reconstruction of every phase.

## Phases (see `plan.md` for the full running log)

- [x] Phase 2 — workspace, Make GIF, cut-out engine
- [x] Phase 3 — cut-out UI, transform and GIF Maker servers
- [x] Phase 3b — cut-out redesign (Decision 14)
- [x] Phase 4 — timing tools, then transform UI
- [x] Phase 5 — GIF Maker UI

## Member cards

- [x] **MPI-771** — GIF cut-out with SAM3 by name · `done`
- [x] **MPI-836** — every operation respects the trim bar; Speed and Loop become output fields · `done`
- [x] **MPI-857** — duplicate a frame from the strip's right-click menu · `done` (`b2a6ecb2`)
- [x] **MPI-858** — cut-out no longer blacks out an already-transparent clip · `done` (`e83b219e`, Fabio verified 2026-09-21)
- [x] **MPI-859** — cut-out masks compose: Add / Subtract over All / Frame / Selected · `done` (Fabio verified 2026-09-21)
- [x] **MPI-861** — `gif-workspace.spec` flake: masks planted while Reverse runs · `done`
- [ ] **MPI-871** — playback ignores the trim bar; the viewer plays the whole clip · `doing`,
      picked up 2026-09-21 10:52 after Fabio chose option (a): playback clamps to the trim and
      loops back to the in-handle

## Close condition

MPI-871 is the last open member. When it closes, this umbrella closes with it.

## Known, not carded

- `docs/masking-sam3-gif.md` is ~310 lines against the 200-line cap. Its own job, not a blocker.

# MPI-742: see the H3 licence chip and footer in a running app

Split out of **MPI-666** on 2026-09-13 so that card could close. The code shipped there; this is
the one piece of it nobody has seen on screen.

## What has never rendered

MPI-666 widened the Flow Library's licence check from `verify` to `verify || territory`
(`_licenceErrands` in `MpiFlowLibrary.js`), because MiniMax H3 has no HF `verify` gate, only a
territory bar. With H3 the chosen model and **not installed**:

1. The Extend Video tile must read **`LICENCE REQUIRED`**, not `GET MODELS`.
2. Its drawer footer must read **`REVIEW LICENCE`**, not `VERIFY LICENCE` or `INSTALL MODELS`.

Only `tests/flow-licence-surface.test.cjs` covers this today ("a territory bar is an errand too").

## Already seen, don't redo

MPI-591 ran MPI-666's checks 3-5 in an isolated app on 2026-09-02, and all passed: the drawer's three
links, the step-0 attribution inside a project, and the gate not firing again on reopen. Evidence:
`tasks/MPI-591/validation.md` § "Phase 5 — in an isolated app".

## Why it could not run on Fabio's machine

`minimax-h3-ref2va` is installed on the shared models root, so Extend Video is available and the
tile reads `Ready`. The chip branch only runs for an unavailable flow. A cleared receipt or a
separate profile does not help, because the weights decide it, not the profile.

## How to reach it (settle this first)

Isolated app with an EMPTY models root, the same setup MPI-666 phase 1 used (`validation.md` there,
"Seen in a running app"). **Trap:** Extend Video's slot is
`models: ['ltx-23-balanced', 'minimax-h3-ref2va']`, and with nothing installed `flowModelIds`
resolves it to the default, which is **LTX** (ungated). So an untouched empty root shows
`GET MODELS`, which is correct for LTX and proves nothing about H3. Pick H3 in the drawer's model
picker first. MPI-591 also saw the tile chip lag behind a drawer pick until the library is reopened,
so read the tile after reopening.

If the tile or footer shows the klein-9b wording, `_licenceErrands` has narrowed back to `verify`.

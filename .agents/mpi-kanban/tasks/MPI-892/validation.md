# MPI-892 Validation

## Automated (2026-09-30, Agent 73)

- `npm test`: 2409 tests, 2407 pass, 0 fail, 2 skipped.
- `npx eslint --max-warnings=0` on every changed file: clean.
- `tests/agent-flow-handover.test.cjs` (8) and the MPI-892 block of `tests/agent-loop.test.cjs` (5):
  mutation-checked. Disabling the loop's routing fails 3 loop tests; dropping `allowEmpty` fails
  3 renderer tests (Scribble among them: its slot is required on the op, so without the opt-out
  it could not open without a drawing).
- Budgets: SYSTEM 10,403 (down 51, the stale Duration sentence gone); TOOLS 18,370 (+192 for
  `open`, reason in `TOOLS_BUDGET`).

## Live, own isolated app (never :3000)

`%TEMP%/c892`, port 63551, `POST /connector/open-flow` with `follow: true`, screenshots taken:

- Scribble: opened on "02 Draw it", "What is it?" filled, blank canvas, nothing queued.
- Object Stamp (two pictures): opened on "02 Cut it out" with the object loaded, hint returned.
- Song: opened on "03 Generate" with "Your song" filled.
- Text to Speech, no voice: opened on "01 Inputs", voice slot empty, `empty` named it.
- A second open while a Flow was already up: refused `VIEW_BUSY`, nothing replaced.

Found live and fixed: Scribble reported its drawing slot as "still needed" (the drawing IS the
step); the answer now mirrors the frame's `_stepDerivesOwnMedia`. A missing required input now
opens on Inputs even for an `agentOpens` Flow (Draw It In with no photo).

## Fabio's look (Verify mode user-ux)

- 2026-09-30, check 1 ("make a scribble of a cat on a fence"): my test line was the wrong
  trigger. Cosmo read Scribble's settings and then ran Klein 9B with its Doodle style (log:
  `klein-9b:t2i styleSelect=5`), no `flow.open` sent. Fabio: that is the right route, and a
  better result. The Scribble trigger is the user wanting to DRAW ("can I give you a scribble and
  you turn it into a nice image?"). app:flows now says that in one paragraph.
- Fabio's shape for that ask: Cosmo answers "two ways, one Flow each" (Draw It In adds a scribble
  to an image, Scribble makes one from a drawing) as `[options: ...]` buttons, then opens the pick
  at its drawing step; "I've drawn it" gets "go to the last step and press Generate". In app:flows;
  the Flow rule now reads app:flows before an ANSWER about a Flow too (SYSTEM 10,423 / 10,460).

Not run through a real model: the loop's routing is unit-tested with a scripted model.

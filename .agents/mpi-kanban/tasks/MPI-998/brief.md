# MPI-998 Brief

Object Stamp: flip the object before placing it.

Umbrella: MPI-1000 (plan.md there holds the phase and file ownership).

## Why

Fabio, 2026-09-30, testing MPI-892's Object Stamp open: the "03 Place it" step lets the user
move, scale and (Alt + drag a corner) rotate the object, but there is no way to mirror it. An
object facing the wrong way for the scene cannot be fixed without leaving the app.

## Shape

- A flip control on the Place it step (horizontal at least; vertical only if it costs nothing
  extra). A component, never a bare button; icon from `js/utils/icons.js`.
- It must reach the RUN, not just the preview:
  - Auto: the stamp is drawn into the scene frame client-side (`MpiStepPlace.js`, the file the
    graph runs on), so mirroring the draw mirrors the run.
  - Manual: the run gets the cutout stage's media as-is and only the region from the step, so a
    flip there has to reach that media too, or Manual shows no flip.
- Undo, Reuse and the persisted step value keep the flip (the step's reported value).

## Where

- `js/components/Organisms/MpiStepPlace/MpiStepPlace.js` (the step, the stamp render)
- `js/components/Primitives/MpiCanvas/managers/ShapeManager.js` and `MpiCanvas.js` (the
  `'place'` gizmo draw), only if the preview is drawn there
- `js/components/Organisms/MpiToolOptionsPlace/` is the History workspace's place tool: same
  gizmo, so decide once whether it gets the flip too (Fabio's call; default: Flow step only).

## Verify

- Unit: the step value carries the flip and the Auto stamp file comes out mirrored.
- Live on an isolated app: Object Stamp, flip, Generate; the result shows the object mirrored,
  in Auto and in Manual.

## Noticed

- `_deriveRunMedia` (MpiBaseFlow.js) reads a null from a step kind as "nothing changed", so a flip (or an Auto stamp) that fails to derive, e.g. the object will not load, runs silently unflipped/unstamped. Root fix: separate "failed" from "unchanged" in the `stepValueToMedia` contract.
- Importing `stepKinds.js` in bare Node pulls `concatProgress.js`, which opens an `EventSource` at import time (a caught ReferenceError in tests; the flip test stubs it).

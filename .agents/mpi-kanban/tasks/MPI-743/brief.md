# MPI-743: a refused licence gate is a silent no-op in the Flow Library

Split out of **MPI-666** on 2026-09-13. MPI-666's title named two defects. It fixed the first
(Flows could not see licence gates) and filed this one without taking it, because the fix
touched a file MPI-500 owned. MPI-500 is `done` now.

## The defect

`downloadService.start()` shows `MpiLicenceGate` for a gated key. On refusal it does
`if (!accepted) return undefined;`. On success it returns `_installChain`, which also settles to
`undefined`. The two outcomes are the same value, so no caller can tell them apart.

`MpiFlowLibrary._installMissing()` ignores the return value, and the tile's progress counts jobs.
After a Cancel, or a failed `verify` probe, no job exists and the tile quietly goes back to
`Install`. The comment at `_installMissing` records the same reasoning.

## Shape MPI-666 proposed

- `start()` returns `false` on refusal. Every other caller (`MpiModelManager` x3,
  `commandExecutor`, `shell.js` x2) awaits and discards the result, so that change is safe.
- `_installMissing` reacts to `false`.

**Open product call:** does a deliberate Cancel need any message now that the tile shows
`Licence required` and the drawer carries the licence links? A failed `verify` probe is the
stronger case for one.

## Noticed alongside, same file, low severity

From MPI-591's isolated run (2026-09-02): picking an uninstalled model in the Extend Video drawer
updates the drawer at once, but the tile chip keeps reading `Ready` until the library is reopened.

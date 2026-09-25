# MPI-907 Plan - Toast mascots

Under umbrella MPI-846. Scope reset by Fabio 2026-09-25: **no animated clips on toasts** - at
54px they will not look good. Keep STILLS; the only change is picking the right mascot.

## Current State

Built + green (session b13c4313, validation.md); awaiting Fabio's look at a finished-generation
toast. Then close MPI-907, and MPI-908 (Phases 1-2 + the double frame all verified).

## Implementation

- `MpiToast.js`: new `mascot` prop (studio | vision | video | audio | prompt, default studio).
  Pose per variant as today (info idle, success happy, warning greet, danger idle), drawn from
  `assets/mascot/<key>/<pose>.webp` instead of the flat Studio PNGs. `'error'` (5 GIF cutout
  call sites pass it; it fell back to an "Info" toast) is an alias of `danger`.
- `statusBar.js` `notify(..., opts)`: passes `opts.mascot` through.
- `notificationService.js`: the coalesced "N generations finished" toast shows the op's mascot
  (`getCommandAccent(item.operation)`) when every counted completion shares one, else Studio.
  Every other toast is app-wide: Studio (Cosmo).

Ownership: js/components/Primitives/MpiToast/MpiToast.js, js/components/Primitives/MpiToast/MpiToast.css,
js/shell/statusBar.js, js/shell/notificationService.js, tests/desktop/toast-mascot.spec.js,
docs/mascot-placement.md

## Verification

**Verify mode:** user-ux

Desktop spec: each variant's still + the mascot prop + `'error'` -> Failed. Fabio looks at a
finished-generation toast live.

## Completed

## Remaining Work

Implementation.

## Plan Drift

- 2026-09-25: Fabio dropped the animated toast clips (card title says idle / happy / heads-up /
  failed clips); stills per mascot instead.

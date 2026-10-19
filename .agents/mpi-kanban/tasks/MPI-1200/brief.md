# MPI-1200 - model-settings-popup desktop spec fails most runs

Found 2026-10-19 at the 2.1.1 release gate (`npm run test:desktop`, Version 2.1 readiness 10).

## What fails

`tests/desktop/model-settings-popup.spec.js:25` (the MPI-443 dead-picker gate), first assertion:
`loraPicker: trigger click did not register` - `rootIsOpen` false 150 ms after `.click()` on the
first LoRA slot's `.mpi-tree-picker__trigger`. Full suite 245/246 (28.1 min); alone, 1 pass then
`--repeat-each=5` gave 4 failed / 1 passed. The upscale half is never reached.

## What it is NOT

- Not the app: Fabio opened LoRA & Upscale in his running app the same day, picked a LoRA and opened
  the Style dropdown fine.
- Not 2.1.1: its only code change is server-side (`routes/runpodRemote.js`, MPI-1199). The picker
  and `MpiModelSettings` are byte-identical to v2.1.0, so v2.1.0 almost certainly fails it too.

## Lead (unproven)

`MpiTreePicker` opens synchronously on `click` (`MpiTreePicker.js` ~268). The spec captures
`loraRoot` once, then measures it. If `MpiModelSettings` re-renders after `open()` (its live
state:changed re-render, MPI-356, or the open-time rescan landing late) the captured root is
destroyed and replaced, so the click lands on a dead node. Only `MpiModelSettings.js` changed since
v2.0.1 (6028507d2, MPI-1057 Upload models overlay). Confirm by logging `document.contains(loraRoot)`
after the click, then fix the root cause (the extra re-render, or wait for the settled DOM), not
the sleep.

## Done when

The spec passes `--repeat-each=10` and the full `npm run test:desktop` is green.

# MPI-761 - The release line ships the pre-LanPaint Inpaint help

Raised 2026-09-15 from the Cubric Studio docs pass for 1.5.0 (MPI-18 in that repo), at Fabio's request.

## What is wrong

- v1.5.0 was cut from the `1.4.2` maintenance branch, not master (see `a9f3a85b`).
- v1.5.0 runs LanPaint Inpaint (MPI-706 port, `2603f668`) on klein-4b, klein-9b, the five
  SDXL / ILL / PONY cards and both Krea 2 cards: all nine inpaint graphs carry
  `LanPaint_KSampler`. The model sees under the mask, an empty prompt does nothing, and a
  removal has to name its target.
- The in-app help at v1.5.0 (`js/data/commandRegistry.js`, `inpaint`: `info`, `help`,
  `promptRequired: false`) is still the pre-LanPaint copy: "The model can NOT see what is
  under your mask", "Leave the prompt EMPTY to remove", "Never write an instruction to
  delete something", with `''` as the erase example and `remove the tattoo` marked bad.
  Every line now says the opposite of what the op does.
- `c7493555` (MPI-367, 2026-08-22) rewrote that entry from Fabio's own runs, and the Detail
  entry that contrasted itself with Inpaint, and `tests/op-strip-availability.test.cjs`.
  It is on master only: not an ancestor of `v1.5.0` or `origin/1.4.2`.
- Confirmed live by Fabio 2026-09-15: FLUX.2 Klein 9B, rider masked, prompt
  "Remove the man." removed him cleanly.
- The docs site now documents the real behaviour and tells readers the guide inside 1.5.0
  is out of date, so the two disagree until this ships.

## Do

1. On `1.4.2`, port the Inpaint and Detail help from `c7493555`: `js/data/commandRegistry.js`
   and `tests/op-strip-availability.test.cjs` only. The card and `docs/models/klein/9b.md`
   changes in that commit are master history, not release-line content. Port by hand if a
   cherry-pick drags in master-only context.
2. `npm test` on the branch.
3. Add a Fixes line to the release line's pending notes so the next 1.5.x changelog says
   the Inpaint guide was corrected.

## Not needed if

The next release is 2.0 cut from master: master already carries the fix. Close as
`rejected` with that reason.

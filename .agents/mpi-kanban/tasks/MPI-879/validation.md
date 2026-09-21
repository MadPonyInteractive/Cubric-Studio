# MPI-879 - validation

## What changed

`js/components/Organisms/MpiPromptBox/PromptBoxControls.js` only.

- New export `durationBoundsFor(model)`: a cloud model (`provider` + `cloud.endpointId`)
  gets `durationRangeFor(endpointId)` - the provider's own range, parsed from the price
  snapshot's prose by `deepinfraSizing.js`. Everything else, including a cloud model that
  publishes no duration field, keeps the app's `{ min: 1, max: 30 }`.
- The `duration` control mounts with those bounds: the saved-value clamp, `MpiProgressBar`'s
  `min`/`max`, the `input` label clamp and the `change` clamp all read one `_clamp` built
  from the range, and the entry stores `_bounds` so `getInjectionParams` - which takes no
  opts - can clamp too, falling back to 1..30 when called off a spread copy of the entry
  (the shape `tests/control-snapshot-injection.test.cjs` uses).

`deepinfraSizing.js` and `cloudExecutor.js` are untouched: `buildSizeFields`' out-bound
clamp stays as the backstop, so a dispatch from any other path is still bounded.

## Evidence

**Real DOM, 2026-09-21.** The mounted control rendered in a page serving the repo's own
modules over http (scratchpad server + playwright-cli), one mount per model, reading the
`<input type="range">` the slider actually produces:

| model | rendered `min` | rendered `max` | published range |
|---|---|---|---|
| `seedance-15-pro-cloud` | 4 | 12 | 4-12 |
| `seedance-2-cloud` | 4 | 15 | 4-15 |
| `wan3-cloud` | 2 | 30 | 2-30 |
| `veo-31-cloud` | 1 | 30 | none published |
| `wan-22` (local) | 1 | 30 | n/a |

The first row is the reported defect measured the same way it was reported: it rendered
`min="1" max="30"` before this change.

**Unit.** `tests/cloud-duration-bounds.test.cjs`, 6 tests, all green. It pins Seedance 1.5
to 4-12 by hand (asserting only "equals `durationRangeFor`" would still pass if both
collapsed to the default), sweeps every shipped cloud video model against its published
range, holds 1..30 for a local model / no model / Veo, clamps an out-of-range saved value
through `getInjectionParams`, and asserts by source that the slider mounts with
`bounds.min`/`bounds.max` - a helper nothing wires in would otherwise pass every other
assertion and ship the bug.

**Neighbours.** `control-snapshot-injection`, `inject-params-titles`, `cloud-price-tag`,
`cloud-executor`, `deepinfra-catalogue`: 85 tests, 0 failures.
`npx eslint` on both changed files: clean.

## Left behind

Veo 3.1 (`veo-31-cloud`, `veo-31-fast-cloud`) publishes no `duration` field, so its slider
changes nothing at any range - `buildSizeFields` emits no duration for it and the provider
runs its own length. Narrowing the range cannot fix that; the control should not mount for
those two models at all. Not carded yet - raised with Fabio 2026-09-21.

# MPI-967 checklist

Fabio (2026-09-28): a filter in the Model and Flow libraries that shows only what can run on the user's card.

- [x] `fitsHardware(model, engine, vramGb, ramGb, variantTokens)` in `footprint.js`: VRAM at or above the table's floor, and system RAM covering the spill at that VRAM. No OS reserve ("can possibly run", like the table). Unknown VRAM means no fit.
- [x] Model Library: a `Fits my GPU` tag in the filter bar, judged against this PC's `/system/stats` (VRAM + RAM), local engine and local arch.
- [x] Flow Library: the same tag; a Flow fits when every required-model slot has at least one candidate that fits.
- [x] `tests/footprint-fit.test.cjs` pins the fit rule.
- [x] `docs/model-library.md` records the rule.
- [x] Live check on an isolated instance: tag narrows both grids with the tester's 12GB/16GB box stubbed (see validation.md).

Out of scope, flagged: `routes/connector.js` `fit.runs` is true for every model whenever VRAM is known (nearest row, not a reachable row).

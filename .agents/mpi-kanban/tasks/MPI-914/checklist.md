# MPI-914 checklist

- [x] `modelQuote(model)` exported from `deepinfraPricing.js` — the Model Library tile's quote (price + unit), one copy
- [x] Picker cloud tiles carry the same `mpi-tile__chip--paid` chip (Video orange for clip models) and the unit in the meta line
- [x] `tests/model-picker-cloud.test.cjs` updated and green; `tests/paid-models-section.test.cjs` still green
- [ ] Follow-up: `MpiModelManager.js` `_paidQuote` swaps to `modelQuote` — file held by a live MPI-908 claim at start, not touched here

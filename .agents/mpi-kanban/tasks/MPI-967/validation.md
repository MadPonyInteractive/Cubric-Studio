# MPI-967 validation

## Rule

`footprint.js` `fitsHardware(model, engine, vramGb, ramGb, variantTokens)`: round VRAM and RAM to the nearest GB, then VRAM >= the trade table's floor (`minVramGb` override included) and RAM >= `ramNeededGb(totalWeights, vram)`. Unknown VRAM fits nothing; unknown RAM is not held against the model. No OS reserve.

The rounding is load-bearing: this box's RTX 4060 Ti reports 15.996 GB through `/system/stats`, so an unrounded compare turns away every model floored at 16.

## Unit

- `node --test tests/footprint-fit.test.cjs`: 4/4 pass (floor, override, just-under-size card, unknown VRAM/RAM, RAM judged at the machine's own VRAM using the heaviest local model).
- `npm test`: 2184 tests, 2182 pass, 0 fail.
- `npx eslint` on the three touched source files: clean.

## Live (isolated instance, port 64029, own profile; user's :3000 untouched)

Real hardware read: 15.996 GB VRAM, 63.8 GB RAM. Every local model fits, so the grids do not change on this box.

With `/system/stats` stubbed to the photographer tester's box (12 GB VRAM, 15.9 GB RAM):

- Model Library: 36 tiles to 28 with the tag on. Hidden: MiniMax H3, MiniMax H3 Reference, Chroma Flash, Qwen Image Edit, Wan 2.2 Smooth, LTX 2.3, LTX 2.3 Balanced, Boogu Edit High. Matches the offline matrix exactly. DeepInfra section unaffected (it ignores Tier too).
- Flow Library: 15 tiles to 12. Hidden: Extend Video, Add Foley, Upscale Video (all need `ltx-23-balanced`). Matches the offline computation. Flows with no `requiredModels` (audio Flows, the Gumroad Head Swap / DramaBox tiles) cannot be judged and stay.

The age gate on the fresh isolated profile was not clicked through; the libraries were opened from page JS behind it.

## Open

- Fabio: label and placement ("Hardware" group, "Fits my GPU" tag), and whether it should follow a connected Pod (it judges this PC only).
- Flagged, not fixed: `routes/connector.js` `/connector/models` sets `fit.runs` from the NEAREST table row, so it is true for every model whenever VRAM is known. `services/agentLoop.mjs` `compactCatalogue` reads it for `best` and `runsHere`.

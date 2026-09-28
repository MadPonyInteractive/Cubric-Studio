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

## Round 2: follows the connected Pod (Fabio, 2026-09-28)

Fabio: label and placement are fine; the filter must judge the connected GPU, since on a rented Pod it is the only way to see what that card runs.

Model Library reuses `_activeVramGb()` plus a new `_activeRamGb()` (Pod RAM off `remote:connection`), `_engine()` and its arch. Flow Library gained its own `remote:connection` listener; the shell feed re-emits every tick, so a library first opened after the connect catches up.

Live, isolated instance port 65398, local stubbed to 12 GB / 15.9 GB, then `remote:connection` emitted by hand:

| active GPU | Models (of 36) | Flows (of 15) |
|---|---|---|
| this PC 12/16 | 28 | 12 |
| Pod 48 GB / 62 GB RAM | 36 | - |
| Pod 24 / 31 | 35 (LTX 2.3 hidden, matches offline) | 15 |
| Pod 16 / 24 | - | 12 (the three LTX Flows hidden) |
| connecting | 28 (local, same as the table) | - |
| disconnected | 28 | 12 |

Lint clean on both components; `fitsHardware` itself unchanged, so `tests/footprint-fit.test.cjs` still covers the rule.

## Open

- Handed to MPI-968 (Fabio started it 2026-09-28): `routes/connector.js` `/connector/models` sets `fit.runs` from the NEAREST table row, so it is true for every model whenever VRAM is known. `services/agentLoop.mjs` `compactCatalogue` reads it for `best` and `runsHere`.

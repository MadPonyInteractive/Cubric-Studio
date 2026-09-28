# MPI-968 validation

## Change

`routes/connector.js` `modelFit(fp, model, engine, hw)` builds each model's `fit` on `GET /connector/models`:

- `runs` = `footprint.js fitsHardware` (MPI-967, the Library "Fits my GPU" rule). Was `tradeTable`'s nearest row, flagged whenever VRAM is known, so every model read `runs: true`.
- `ramGbAtYourVram` = `ramNeededGb` at the machine's own rounded VRAM, null when unknown. Was the nearest row's RAM.
- `floorVramGb` unchanged (`tradeTable().vramFloor`).
- Arch token resolved server-side in `_getHardwareInfo`: local `resolveDownloadConfig().gpu.arch` (what `/system/gpu-info` serves the renderer), remote `gpuArch(pod gpuName)` (the renderer classifies the pod `gpuType` the same way). Kept out of the response's `hardware`.
- A cloud model (`provider`) gets no `fit`: no weights, and a floor of 8 would call it `runsHere: false` on a small card.

`services/agentLoop.mjs` is unchanged: `compactCatalogue` already skipped `fit.runs === false` for `best` and emitted `runsHere: false`; it now has something to read.

## Evidence

- `tests/connector-model-fit.test.cjs`: floor 16 on a 12GB card reads `runs: false` (15.99 reads true); RAM judged at the machine's own VRAM; cloud model has no fit; unknown VRAM runs nothing, RAM null. 4/4 pass.
- `npm test`: 2191 tests, 2189 pass, 0 fail, 2 skipped.
- Route smoke (router on an ephemeral port, fake renderer, REAL hardware probe; no app instance touched): RTX 4060 Ti 15.996GB / 64GB -> minimax-h3 `{12, 36, true}`, ltx-23 `{16, 44, true}` (44 = the footprint.js calibration anchor), ltx-23-balanced `{12, 28, true}`, krea2 `{8, 12, true}`, klein-9b `{8, 8, true}`, flux-schnell-cloud no fit. `hardware` = `{gpuName, vramGb, ramGb}`, no arch.

## Product effect (every local op assumed installed, arch modern)

| Box | `best` moves |
|---|---|
| 8GB / 16GB | t2i, i2i, control, inpaint, detail krea2 -> klein-9b; upscale krea2 -> klein-9b; edit boogu-high -> boogu-balanced; i2v/t2v minimax-h3 -> wan22-5b; ref2v -> none |
| 12GB / 16GB (the photographer tester) | edit boogu-high -> boogu-balanced; i2v minimax-h3 -> wan22-5b (r4); t2v minimax-h3 -> wan22-5b (r3); ref2v -> none |
| 12GB / 32GB, 16GB / 32GB | i2v/t2v minimax-h3 -> ltx-23-balanced; ref2v -> none |
| 24GB / 64GB, and this 16GB / 64GB box | nothing moves |

Nothing is capped: every op stays listed and callable, the non-fitting ones carry `runsHere: false`.

## Close

- Fabio OK'd the product effect and the push (2026-09-28).
- CI `Tests` run 36419464374 on `6a4fe2e7b`: success.

## Left open

- `docs/agent-chat.md:53` still names `tradeTable` as the fit source; the file is claimed by the MPI-941 session.

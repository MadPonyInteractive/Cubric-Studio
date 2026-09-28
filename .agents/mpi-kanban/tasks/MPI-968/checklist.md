# MPI-968 checklist

Flagged out of scope on MPI-967. `GET /connector/models` built `fit` from `tradeTable(model, engine, vramGb)`, whose nearest row is ALWAYS `isUserRow` once a VRAM is passed, so `runs` was true for every model and `ramGbAtYourVram` was the nearest row's RAM. MPI-916's `best: true` skip and `runsHere: false` in `agentLoop.mjs compactCatalogue` never fired.

- [x] `routes/connector.js`: `runs` = `footprint.js fitsHardware` (the Library "Fits my GPU" rule), `ramGbAtYourVram` = `ramNeededGb` at the machine's own rounded VRAM (null when unknown), arch token resolved server-side (local `resolveDownloadConfig().gpu.arch`, remote `gpuArch(pod gpuName)`).
- [x] Test pins the bug case: floor 16 on a 12GB card reads `runs: false`.
- [x] `.claude/skills/cubric-vision-generate/SKILL.md` says what `runs` / `ramGbAtYourVram` mean.
- [x] `npm test` green.
- [x] Fabio OKs the product effect (which op reads `best` on low-VRAM/RAM machines) before push.

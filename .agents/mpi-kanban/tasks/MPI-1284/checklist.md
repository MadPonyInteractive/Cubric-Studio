# MPI-1284 checklist: H3 Reference on Singularity v2

- [x] Licence: repo tags apache-2.0, base_model MiniMaxAI/MiniMax-H3, so it is treated as bound by the H3 Community Licence; ships behind the existing MINIMAX_H3 gate, publisher URL, never R2 (2026-10-26)
- [x] sha256 from HF: d7637c2c35cd30facd9e93778c491f6d82f91c4a441aecbdb4c384a62a5f3d9f, 20967647456 bytes
- [x] New dep `minimax-h3-singularity-ref2va-transformer`; old ref2va dep KEPT, marked DEPRECATED (orphan sweep)
- [x] r2va raw template + generator spec + runtime point at the Singularity file (5d3e0674a)
- [x] Video Edit Flow on Singularity too (Fabio 2026-10-26: a reference job, not i2v) (a2fc697ca)
- [x] lint + tests green, both pushes
- [x] Cleanup (Fabio OK'd): bench volume cubric-h3-bench deleted (RunPod lists none); FastH3 Trim + bench folders, MOSS ops bench, RTX5090 H3 Tests, Video editor tests, BoxesTest3 -> Recycle Bin
- [ ] Fabio: one H3 Reference clip on Singularity (restart the app first)
- [ ] Fabio + agent: Video Edit test runs on Singularity, swap person / head / outfit (the swap LoRAs were trained on the original weight)
- [ ] After Video Edit passes: old weight `minimax_h3_ref2va_pruned_int8_convrot.safetensors` and the MPI-1036 Video Edit in-app project -> Recycle Bin

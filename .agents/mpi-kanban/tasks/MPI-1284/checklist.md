# MPI-1284 checklist: H3 Reference on Singularity v2

- [x] Licence: repo tags apache-2.0, base_model MiniMaxAI/MiniMax-H3, so it is treated as bound by the H3 Community Licence; ships behind the existing MINIMAX_H3 gate, publisher URL, never R2 (2026-10-26)
- [x] sha256 from HF: d7637c2c35cd30facd9e93778c491f6d82f91c4a441aecbdb4c384a62a5f3d9f, 20967647456 bytes
- [ ] New dep entry for the Singularity v2 transformer; old ref2va dep KEPT (Video Edit Flow still loads it)
- [ ] r2va raw template + generator spec + runtime point at the Singularity file
- [ ] H3 Reference ModelDef depends on the new dep; Video Edit Flow declares the old transformer itself
- [ ] lint + tests green
- [ ] one H3 Reference run in an isolated app loads the Singularity file

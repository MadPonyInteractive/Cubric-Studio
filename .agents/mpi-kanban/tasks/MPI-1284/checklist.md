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
  - 2026-10-26 7 s swap-person: in sync; back turn at the end -> template 1 back-turn clause dropped (6a6b49107 + API). Re-run on the 5 s clip: no back turn (Fabio, 2026-10-26, seen in the latents at 50%)
- [ ] Video Edit with Fast Motion always on (Fabio 2026-10-26: over 768p it runs out of memory at 16 GB, since the single pass has no windowing): a separate bench graph in `research/video_edit_fm/` (builder `flow_graph_fm.py` -> `flow_video_edit_fm_api.json`), checked against the engine's node list, NOT run and NOT wired. Waits on Fabio's 768p test
- [x] Fabio 2026-10-26: Singularity is its OWN model. Video Edit runs went 3 s pass (better than the original), 5 s fail, 7 s pending: length looks like the problem. `minimax-h3-singularity` card added on the same r2va graph (`generate_h3.py` writes `minimax_h3_r2va.json` original + `minimax_h3_r2va_singularity.json`); H3 Reference back on the original weight, old dep un-deprecated; licence, rank 2 in ref2v, bars, Cosmo guide, docs, release note; Video Edit slot `['minimax-h3-ref2va', 'minimax-h3-singularity']` with `modelParams` on `Input_Base_Model` (raw retitled, synced). lint + 3684 tests + release:check green. NOT run in the app, NOT committed (the sync auto-committed the raw retitle locally, cb7b5ca3d, unpushed)
- [x] Video Edit recommends H3 Reference, Singularity second (Fabio 2026-10-26) — already the slot's order
- [ ] Fabio's 7 s Video Edit run on Singularity (length looks like the problem)
- [ ] ~~After Video Edit passes~~ NO LONGER: the old weight is H3 Reference's again and stays. Only the MPI-1036 project is left to recycle: old weight `minimax_h3_ref2va_pruned_int8_convrot.safetensors` and the MPI-1036 Video Edit in-app project -> Recycle Bin
- [x] Close-out 2026-10-26: Fast Motion route verified at 960 on both weights (no OOM, 13 min); Singularity does not copy the moves at 960, so the Flow description warns and H3 Reference stays recommended (7fad81faf). Fabio app-tested the model split: fine. The open Fabio items above are settled by these runs. The MPI-1036 project is KEPT (Fabio wants some of its items), not recycled. Retiring the old weight is off the table for now.

# MPI-1350 checklist

- [x] MpiWindowedSampler: `window_frames = 0` (new default) sizes the window from the engine's usable VRAM (ComfyUi-MpiNodes `sampler.py`, d503a6d, pushed)
- [x] CPU unit test: on a 16 GB card (14-16 GiB usable) every ladder bucket and boundary gives the old ladder's number, evaluated through `safe_math` on the graphs' exact string (`tests/test_windowed_auto.py`)
- [x] Node pinned in `dev_configs/node_lock.json` (98c883f8b, pushed)
- [x] `minimax_h3_fl2va`, `minimax_h3_r2va`, `minimax_h3_r2va_singularity`, `flow_h3_upscale` + raw/API templates: Window Frames = 0 (094b1c7d8, pushed). `generate_h3.py` re-bakes the H3 runtimes identical.
- [ ] `flow_video_edit.json` + `raw/flow_video_edit.json`: waiting on Strip Node Packs 5 (MPI-1341) to commit its hunks in both files, then the same scalar edit
- [x] `npm run lint` + `npm test` green (3816 pass, 0 fail; pre-push gate passed)
- [ ] One other memory size measured: needs the bench GPU lease (busy: MPI-1341 A/B, then the MPI-578 sigma ladder) or a Pod with Fabio's OK
- Not used: system RAM. ComfyUI streams offloaded weights from RAM, so short RAM costs speed, not activation VRAM; nothing measured ties it to the window.

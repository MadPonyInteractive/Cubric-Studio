# MPI-1350 checklist

- [x] MpiWindowedSampler: `window_frames = 0` (new default) sizes the window from the engine's usable VRAM (ComfyUi-MpiNodes `sampler.py`, d503a6d, pushed; that ladder-scaled rule was REPLACED by the pixel-frames rule in 5000dc1, see the speed-probe item)
- [x] CPU unit test: on a 16 GB card (14-16 GiB usable) every ladder bucket and boundary gives the old ladder's number, evaluated through `safe_math` on the graphs' exact string (`tests/test_windowed_auto.py`; superseded in 5000dc1: auto now gives ~105 at 2K, not the ladder's 90, and the test asserts the measured limits instead)
- [x] Node pinned in `dev_configs/node_lock.json` (98c883f8b, pushed; re-pinned to 5000dc1 in a2ab9e956)
- [x] `minimax_h3_fl2va`, `minimax_h3_r2va`, `minimax_h3_r2va_singularity`, `flow_h3_upscale` + raw/API templates: Window Frames = 0 (094b1c7d8, pushed). `generate_h3.py` re-bakes the H3 runtimes identical.
- [x] `flow_video_edit.json` + `raw/flow_video_edit.json`: Window Frames = 0 (the peer's hunks landed in 382e20a90 first; this commit is the 3 ladder strings only)
- [x] `npm run lint` + `npm test` green (3816 pass, 0 fail; pre-push gate passed)
- [x] One other memory size measured: 12 GB simulated on the 16 GB bench by a VRAM ballast process (`research/capped_bench.py`, H3 2K refine via `flow_h3_upscale`). Auto picked 64 frames and survived; a 107-frame single pass also survived, so auto is safe but conservative at 2K (`validation.md`)
- [x] Speed probe at 12 and 16 GB; auto re-sized to the measured pixel-frames limits (MpiNodes 5000dc1, pinned a2ab9e956); re-bench no slower, seams clean (`validation.md`)
- Not used: system RAM. ComfyUI streams offloaded weights from RAM, so short RAM costs speed, not activation VRAM; nothing measured ties it to the window.

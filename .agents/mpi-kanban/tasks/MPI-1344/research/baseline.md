# Baseline (MPI-1344, Phase 0) — 2026-10-29, before any pack is dropped

Engine: repo-local `engine/ComfyUI_windows_portable`, ComfyUI 0.42.1, Python 3.13.14,
every pack at its `node_lock.json` pin.

| Measure | Value | How |
|---|---|---|
| Python packages installed in the engine | **191** | `python_embeded/python.exe -m pip list` |
| Engine `site-packages` on disk | **5.8 GB** (torch is most of it) | `du -sh` |
| Packages locked for the node set | **151** | non-comment lines in `dev_configs/python_deps.txt` |
| `custom_nodes/` on disk | **2.4 GB** (mostly weights pinned under pack folders, e.g. Chatterbox, RIFE) | `du -sh` |
| Engine start to ready, CPU test start | **42 s cold, 23 s warm** | `main.py --quick-test-for-ci --cpu --user-directory <scratch>` |
| Pack import time, total | **~8.4 s** of the warm 23 s | ComfyUI's "Import times for custom nodes" |

Pack import times (warm): ChatterBox 4.3 · Impact-Subpack 0.9 · LTXVideo 0.9 ·
VideoHelperSuite 0.2 · MelodramaBox 0.2 · RES4LYF 0.2 · audio-separation, MpiNodes,
Impact-Pack, Mickmumpitz, controlnet_aux, KJNodes 0.1 each · the rest 0.0.

## What this means for the umbrella

- **Startup is not the prize.** Every pack this umbrella drops adds up to ~1.5 s; ChatterBox
  (kept) is half the total on its own. Do not sell the diet as "faster".
- **The prize is installs and breakage:** the 151-package lock, the 2.4 GB folder, and the
  number of outside repos that can break an engine on a bump (RES4LYF, MPI-1274).
- **opencv is already solved** (MPI-413: one `opencv-contrib-python-headless` pin for all
  packs). A pack's pip win only counts when its lines leave `dev_configs/python_deps.in`
  and `compile-node-deps --check` still passes.

Re-measure the same rows at the end of each phase.

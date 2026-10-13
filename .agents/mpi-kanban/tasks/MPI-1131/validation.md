# MPI-1131 Validation

- Offline: `ComfyUi-MpiNodes/tests/test_windowed_progress.py` - one bar of steps x windows, value never drops, UI preview bar matches. Passes.
- Live, 2026-10-13, Fabio's app, MiniMax H3 Reference 1344x768, 15 s: engine logged `2 windows of 192 video frames`, stdout showed ONE bar 0/6..6/6, status bar held 2/2 through both windows to 100% (Fabio watched it). Before the fix a 20 s run read 2/2 -> 3/3 -> 4/4.
- Shipped: MpiNodes `ce435f3` pushed, pinned in `dev_configs/node_lock.json` at `8ba8b7e14`; Tests CI green on that commit.
- Not verified on RunPod: a Pod may take MpiNodes from mpi-ci's own node_lock (routes/remotePodLifecycle.js:232), in which case it keeps the per-window bar until that pin syncs.

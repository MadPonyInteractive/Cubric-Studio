# MPI-936 bench run 1 (2026-10-08, session 9435f38c)

Bench `G:\ComfyUi` 0.39.0, RTX 4060 Ti 16 GB, graph `research/bench/graph.py` (fp8_scaled Boogu encoder,
int8 transformer, euler/simple 25 steps cfg 1), run by `research/bench/run.py` under the GPU lease.
Outputs: `C:\Users\Fabio\AppData\Local\Temp\claude\C--AI-Mpi-Cubric-Vision\9435f38c-6769-43d9-90c1-675e43a99985\scratchpad\out\`
(regenerate with run.py if gone: ~4 min). NOT yet eyeballed for quality.

| preset | time | output | bars |
|---|---|---|---|
| t2i_square 1024² | 33 s (cold load) | RGBA, alpha 253-255 (opaque) | 1 |
| t2i_wide 1344x768 | 21 s | RGBA, alpha 252-255 | 1 |
| t2i_rgba (prompt asks transparent) | 21 s | RGBA, alpha 0-255, **64% transparent** | 1 |
| t2i_jacket | 21 s | RGBA opaque | 1 |
| edit_one (1 ref) | 33 s | RGB 1024² | 1 |
| edit_two (2 refs) | 48 s | RGB 1024² | 1 |
| edit_rgba (edit asking transparent) | 33 s | **RGB, no alpha** | 1 |
| edit_masked | FAILED | `InpaintStitchImproved`: size of tensor a (4) must match b (3) at dim 3 | - |

## Findings

- **The graph runs: t2i and 1-ref/2-ref edit from ONE graph**, Input_Image empty = t2i. `progressStages`
  entry is `{ single: 1 }` for both ops (counted from websocket progress restarts, the app's own feed).
- **RGBA on t2i works** from the prompt alone. Every t2i output is RGBA (near-opaque alpha when not asked).
- **The 2.1 VAE decodes 4 channels on EVERY run** (the failure dump shows `[r, g, b, a]` tensors on the edit
  path too), yet edit outputs saved as RGB and edit_rgba gave no transparency. Open: why the edit path loses
  alpha (PreviewImage? the reference latent?). Check the edit template's own output on the bench.
- **Masked edit root cause:** the decoded IMAGE is RGBA, the crop canvas is RGB, and the stitcher blends them
  (`stitch_magic_im`, `resized_mask * resized_image + (1 - resized_mask) * canvas_crop`). Fix: feed the stitch
  the RGB part (core `SplitImageWithAlpha` after VAEDecode on the masked branch). Not a guard: the masked edit
  is an in-place edit of an opaque source, so its alpha means nothing.

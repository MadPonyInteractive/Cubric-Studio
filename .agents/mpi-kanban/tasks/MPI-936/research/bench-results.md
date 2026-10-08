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

## Run 2 (2026-10-08, session 6271e0b6) - supersedes run 1's edit rows

Run 1's edit rows were a HARNESS bug: `run.py` saved the first `images` output in history, which on an edit is
the Input_Image loader's own preview. All three "edits" were pixel-identical to the source. `run.py` now reads
Output_Image (node 35) only. Masked branch fixed with core `SplitImageWithAlpha` (node 46) before the stitch.
Outputs: `scratchpad/out` of session 6271e0b6. Eyeballed (contact sheet): all good.

| preset | time | output | verdict |
|---|---|---|---|
| edit_one | 36 s | RGBA opaque | jacket swapped, face/kitchen/light untouched |
| edit_two (2 refs) | 51 s | RGBA opaque | image 2's suede jacket put on her faithfully, identity kept |
| edit_rgba | 36 s | RGBA, **59% transparent** | clean cut-out of the woman: RGBA works on edit too |
| edit_masked | 45 s | RGB | jacket inside the mask, rest untouched. Soft band where the BOX mask's top edge cuts the collar (the 32 px blend): the bench mask, not the graph |
| t2i_2k 1472x1472 | 60 s | RGBA opaque | sharp, no offload, fits 16 GB alongside nothing else |

## Run 3 (2026-10-08, session 6271e0b6) - Klein's seven ops (graph.py v2, Input_wf_type)

**MpiAnySwitch10 picks the Nth CONNECTED input, not `any_N`.** The first pass had no `any_3` wired (control not
in yet), so wf 5 ran detail, wf 6 ran upscale and wf 7 ran off the end (success, no Output_Image). Valid only
after all seven slots were wired. Rows below are the clean rerun.

| preset | time | output | verdict |
|---|---|---|---|
| i2i (0.65) | 33 s | RGB | works, but "watercolour" stayed a photo; the face drifted. Style needs more denoise (0.85 run pending) |
| edit_masked (LanPaint) | 69 s | RGB | **clean**: run 2's collar band is gone, jacket sits inside the mask |
| inpaint (LanPaint) | 75 s | RGB | plant placed in the box, lit to match, no seam |
| detail (0.35) | 24 s | RGB 1024 | subtle re-render of the face, stitched invisibly |
| upscale 1.5x (0.3) | 73 s | RGB 1536 | sharp, but a fine diagonal CROSSHATCH on skin and cloth. Probe pending: Siax alone vs the 2.1 VAE |
| control_depth | 39 s | RGBA | the bronze statue follows her depth and framing. 4.7% of the subject at alpha 200-240 (ghosting) -> control now outputs RGB |
| control_pose | 36 s | RGBA | astronaut keeps her stance; the Mars background did not come through |

LanPaint runs on 2.1 (ModelType.FLUX, Klein's path; QwenImage21Cache only caches the constant prefix).

Follow-ups, same session:
- **i2i at 0.85: a real painterly restyle** (24 s), the face drifts further. 2.1 holds a photo until ~0.8, so the
  app's 0.30 i2i default only nudges: agent-guide material, not a graph change.
- **The upscale crosshatch is 4x-NMKD-Siax's**, not 2.1's: `probe_siax_only` (upscaler alone, scaled to 1.5x)
  already carries it, the 2.1 VAE round-trip keeps it, denoise 0.45 softens it without removing it. Siax is the
  `defaultUpscale` of every photo model, so this is app-wide (Noticed on the card), not an MPI-936 fix.
- control_depth rerun after the RGB change: RGB, 39 s.

## Findings (run 1; the edit-alpha line is void, see run 2)

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

# MPI-1271 Validation

**Verify mode:** auto (bench renders + tests); Fabio saw the images and asked for close-out.

## Bench — 2026-10-24, G:\ComfyUi :8188, `research/bench_1271.py`

Source `mpi1033_sheriff_portrait.png` (700x1120 portrait), Custom size on asks 1344x768.
Pass = off follows the source shape, on is exactly 1344x768.

| Graph (template) | Off | On |
|---|---|---|
| krea2_t2i_sfw (krea2) | 816x1296 | 1344x768 |
| qwen_edit | 800x1280 | 1344x768 |
| qwen_image_2_1 | 800x1280 | 1344x768 |
| t2i_sdxl_realistic (sdxl) — after fix | 816x1296 | 1344x768 |
| chroma_hyper_t2i (chroma) | 816x1296 | 1344x768 |
| klein_9b_t2i (klein) — after Fabio's rewire | 816x1296 | 1344x768 |

Chroma Flash and Klein 4B were benched through their template twins (Hyper, 9B):
`Chroma1-HD-Flash` and `qwen_3_4b` are not on this machine.

## Found and fixed during the bench

- **SDXL:** on came out 816x1296. The final resize read its size from image 1 at 1 MP
  (GetImageSize 1677 <- 1609). 1677 now reads 'Custom Size (latent)' 1775
  (`research/patch_sdxl_outsize.py`); 5 SDXL runtimes rebaked, one line each.
- **Klein:** on came out 1360x768 — ImageScaleToTotalPixels renormalised the padded map to
  1024x1024 px and rounded to 16. Fabio rewired: depth (now 1024) reads image 1; off =
  depth -> 1 MP (723), on = depth -> pad W x H (719); latent, VAE encode and size read
  'Custom Size (control)' 717. An intermediate version rendered off at 512x800 / 1024x1616.
- **Bench harness:** the first pass "rendered" SDXL/Chroma/Klein in 3 s as the source photo —
  ComfyUI dropped the invalid Output_Image (missing weights) and the script fell back to the
  Input_Image loader's preview. Fallback removed; `node_errors` printed.

## Tests

`node --test tests/control-custom-size.test.cjs` — 6/6. New check: on the control branch,
every Get Image Size upstream of Output_Image reads through Input_custom_size (fails on the
old SDXL graphs). `validate-injection-rules.mjs` passes on every changed template/runtime.

## Look and feel (Fabio's eye)

No black bars reach the output: the model paints the padded sides as scene. The pad edges can
read as vertical posts / door frames (SDXL, Krea2, Qwen-Image 2.1; Qwen Edit least).

# A masked edit shows the model only the mask box, so it cannot keep what is outside it

## The evidence this card was opened on

From ComfyUI `/history` for the 2026-09-22 run of MPI-877 (`kleinEdit` / `klein-9b`,
`Prompt executed in 37.21 seconds`):

```
296 Input_Mask --boolean--> 592 MpiIfElse --true--> 581 InpaintCropImproved output 1
474 Input_Image ----------- 592 MpiIfElse --false-> (the whole picture, maskless path)
592 -> 167 ImageScaleToTotalPixels -> 163 VAEEncode -> the sampler
```

`581` inputs: `context_from_mask_extend_factor: 1.0`, `mask_expand_pixels: 6`,
`mask_blend_pixels: 32`, `output_resize_to_target_size: true`, target 1024x1024.

Staged mask `mpi_staged_d601d8393461b4af.png`, 768x1024, ~8% of pixels set; bounding box
**257x257 at (264, 683)** - the water, with no part of the boy inside it.

Nothing is verified here yet: this is the diagnosis, not a fix.

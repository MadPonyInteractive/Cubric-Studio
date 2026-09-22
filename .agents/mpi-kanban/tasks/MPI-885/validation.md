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

Staged mask `mpi_staged_d601d8393461b4af.png`, 768x1024, bounding box **257x257 at
(264, 683)**.

## What is in that crop — looked at, not inferred

Extracted from `t2i_003.png`: the boy's **whole reflection**, head, hair, white shirt,
rod, upside down. The model was given the reflected boy.

> This card first said the crop was "pure water with no boy in it". That was read off the
> mask's mean brightness and never checked against the pixels; Fabio caught it. The mask is
> painted over the reflection, so of course the reflection is what the crop holds.

## What came back

An **upright** demon rising out of the water, with its own reflection rendered beneath it.
The input was an inverted figure; the output is a right-way-up creature plus a mirror image
of itself.

So the crop did not lose the subject — it lost the RELATIONSHIP. Klein saw a square of
water with an upside-down figure in it, with no bank, no boy above it and no scene
orientation to say the figure IS a mirror image. Nothing in the prompt can supply a
framing the model is never shown.

## Not verified here

Nothing. This is the diagnosis; neither direction has been tried.

# MPI-918 Phase 3 - the three graphs' edit stage (Agent 86, read-only, 2026-10-01)

Spec shape: `cloudEdit: { input, prompt, output }` (`js/utils/cloudEditGraph.js`).

## Draw It In (`flow_draw_it_in.json`) - one reference

- input `106` ImageScaleToTotalPixels (1 MP, steps 16) of `163.1` (crop of `6`, paint on photo) -> `107` VAEEncode (ref 1 + latent_image)
- prompt `185` StringConcatenate "Join Guardrails" (18 + 184) -> `104` CLIPTextEncode
- output `168` VAEDecode
- tail: `192` ColorMatch (mkl, ref 163.1) -> `169` InpaintStitchImproved (stitcher 163) -> `170` -> `146` SaveImage. Deterministic, no model. Pass 2 re-runs the 163 crop (needs 6, 161, 162, 183: box mask / bbox / math).
- decode size = 106's size (in practice 1024x1024).

## Outpaint (`flow_outpaint.json`) - one reference, one pass (no maxGrow)

- input `673` ImageScaleToTotalPixels (lanczos, 1 MP, steps 16) of `553` -> `674` VAEEncode
- prompt `685` RegexReplace "Trim Empty Prompt" (667 = 112 baked + 666 user) -> `671` CLIPTextEncode
- output `682` VAEDecode
- tail: `687` MickmumpitzPanoHarmonizeBoundary (image 682, plate 553, mask 553.1) -> `686` ComposeColorMatch -> `493` -> `494` PreviewImage `Output_Image`. Pure torch, deterministic (checked source: no folder_paths, no RNG).
- HarmonizeBoundary resizes plate+mask to the IMAGE size: the cloud result MUST be fitted to 673's size (pass 2's ImageScale does it).

## Object Stamp (`flow_object_stamp.json`) - TWO references, ref 2 by mode

- `220` Input_Mode drives MpiAnySwitch `221`/`222`/`223` (lazy; 1 = Auto default, 2 = Manual).
- Order is semantic ("image two into the scene of image one").
- ref 1 = the CLEAN scene crop, both modes: `210` InpaintCropImproved -> `211` ImageScaleToTotalPixels -> `212` VAEEncode. **input = 211.**
- ref 2 switches LATENTS at `222`: Auto `107` = VAEEncode(`106`) (crop of 163.1, object stamped on scene); Manual `202` = VAEEncode(`201`) (1 MP of Input_Paint `2`, the object's own aspect). Needs a second input keyed by mode (106 / 201) or an image-level switch.
- prompt `185` (18 = 223 Prompt_Select + 17 user, + 184 empty).
- output `168` VAEDecode; tail as Draw It In (192 -> 169 -> 170 -> 146).
- decode size = 106 = 211 (1024x1024 in practice); Manual's 201 does NOT match.
- `6` (ImageCompositeMasked of 1 + 2) feeds 161's box mask in both modes: Input_Paint is still loaded in pass 2.

## Trap for Object Stamp's second reference (Agent 86, 2026-10-01)

`runCloudEdit` takes the picture AND the pass-2 fit size from `displayUrls[0]`, and
`commandExecutor` fills `displayOutputUrls` in the order ComfyUI's `executed` events ARRIVE
(execution order, not node id or title). With two `Output_Display` taps, index 0 is whichever ran
first: in Manual, ref 2 (201) is the object at its own aspect, so it could go to the cloud as
image one AND set the fit size, misaligning the stitch. Fix: distinct titles per tap and collect
by title/node, never by index. The fit size is always ref 1's (= the decode size).

# MPI-1048 brief

Qwen-Image 2.1 gets its own enhancer recipe + agent guide instead of borrowing Klein's `flux-2`.
Recipe from the official PE-T2I rewriter prompt; the guide's edit section from PE-I2I.

## Noticed
- The Prompt Box @ picker inserts `<Image 1>` on Qwen 2.1 edit (`refTagHandle`), but the encoder labels references `<image1>` (`comfy/text_encoders/qwen_image21.py`). Whether the spelling matters is a render question.
- `modelPriority.js` t2i rank note for `qwen-image-2-1` still says ask for "transparent background, alpha channel"; the vendor template is the two RGBA sentences (both work).
- `RECIPE_ALIASES.flux` comment in `registry.js` lists four models; seven carried it, six now.

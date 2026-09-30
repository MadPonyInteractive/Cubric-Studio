# MPI-971 brief

The card description and `plan.md` carry the job. This file holds what was noticed on the way.

## Noticed

- 2026-09-30: Chroma's i2i (`chroma_t2i.json`, MpiCrop node 2682) takes a native Input_Width x
  Input_Height CENTRE WINDOW of the source instead of resizing it, so any photo much larger than the
  ratio size is i2i'd as a small central crop. Every other image model resizes first. Separate from
  MPI-971; not breaking a release (it has always done this).
- 2026-09-30 (Phase 2): `agentDispatch.js` ONE_AREA_OPS (edit, kleinEdit, krea2Edit, qwenEdit, inpaint)
  is the same set as the new registry flag `cropsToMask`; it could read the flag instead of a second
  hand-kept list. Not changed here (not this card's file).
- 2026-09-30 (Phase 2): a STRAY mask left on the canvas while running a model-sized op that ignores
  it (i2v, i2i) still skips Phase 1's capped copy, so a >13K photo there dies as before. Phase 1's
  rule (masked = leave alone) is unchanged; the fix is knowing which ops read Input_Mask.
- 2026-09-30 (Phase 2): the mask export now leaves the canvas at its working size (<= 4096), so
  "download mask" on a 16K photo saves a 4096 mask (it was an upscaled copy of the same pixels).
- 2026-09-30 (Phase 3): Image Upscale WITH a model runs the model's own x4 FIRST, on the whole
  photo (`image_upscale.json`: ImageUpscaleWithModel, then ImageScaleBy factor/4). So an 8K photo
  (a 45 MP camera) at x1.5 builds a ~33K intermediate, ~8.7 GB as float32, before shrinking to
  12K: likely an OOM on the tester's 16 GB. P-A bounds the OUTPUT only. Pre-existing, not this
  card's decision; asked Fabio.

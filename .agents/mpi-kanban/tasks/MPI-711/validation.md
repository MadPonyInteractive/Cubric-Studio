# MPI-711 Validation

Closed 2026-10-06 on Fabio's decision. The card was an evaluation; it answered its question.

## Evidence

- **Bernini-R does native localised video edits** - Fabio ran ComfyUI's template on the 14B fp8
  pair, 2026-09-09/10: hair recoloured AND background replaced, face/outfit/pose intact, in one
  pass. H3 + LanPaint never moved hue off ~14 at any denoise (`brief.md` § The wall).
- **Masked beats unmasked, as crop-and-stitch** - Fabio, 2026-09-10: a full-frame edit degrades
  the image, a masked one holds. Fabio, 2026-10-06: a small masked region (an object, a small
  animal) also renders ten times faster or more than the whole frame.
- **rv2v character swap from ONE reference image keeps the source motion** - Fabio-verified
  2026-09-13 (`plan.md` § Current State).
- **A reference VIDEO is not a Bernini motion source** - ByteDance's own rv2v test case is
  content insertion; motion transfer stays in Fabio's Wan Animate workflow.

## Decision (Fabio, 2026-10-06)

Reference models now do this job: Fabio has swapped characters, recoloured and changed clothes
in existing clips with MiniMax H3 Reference, and MPI-1033 (2026-10-06, `docs/models/h3/ref2va.md`
§ "Lip-sync holds") records a sounded clip edited with its soundtrack kept. Bernini was built
before open reference video models existed. The product route is a single **Video Edit Flow on
H3 Reference with an optional mask step** - **MPI-1036**, member of the MPI-897 umbrella.

## Not run, and no longer needed

`flow_bernini_video_edit_ctxwin.json` (core `WanContextWindowsManual` for long clips) was wired
and structurally verified 2026-09-13 but never confirmed run: the bench logs that survive
(oldest ending 09-18) carry no context-window line. Left on the bench, untouched.

## Left in place

- `ComfyUi-MpiNodes/bernini.py` `MpiBerniniConditioning.doit` returns 4 values against 3
  `RETURN_TYPES`. No shipped workflow uses the node.
- A VOID object-removal Flow card was proposed (`brief.md` step 5) and never filed.

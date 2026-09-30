# MPI-962 validation

Umbrella — closed 2026-09-30 when its last open member closed. No work of its own; each member
carries its own evidence:

- MPI-959 (EXIF crop) — closed `28547517d`, Fabio verified.
- MPI-961 (16K canvas performance) — closed, Fabio verified; the zoom detail layer deferred by Fabio.
- MPI-963 (landing card thumbnail) — closed, Fabio verified.
- MPI-971 (engine ops on 16K+ photos) — closed 2026-09-30: Fabio verified Phases 2-3 locally and the
  Pod path (masked Klein Edit on the 16K, 2144^2 cut uploaded, 16K card); CI green on `e752180c3`.
  The rule lives in `docs/big-photos.md`.

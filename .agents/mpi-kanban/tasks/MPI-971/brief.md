# MPI-971 brief

The card description and `plan.md` carry the job. This file holds what was noticed on the way.

## Noticed

- 2026-09-30: Chroma's i2i (`chroma_t2i.json`, MpiCrop node 2682) takes a native Input_Width x
  Input_Height CENTRE WINDOW of the source instead of resizing it, so any photo much larger than the
  ratio size is i2i'd as a small central crop. Every other image model resizes first. Separate from
  MPI-971; not breaking a release (it has always done this).

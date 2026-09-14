# MPI-348 Validation

## Closed as REJECTED (Fabio, 2026-09-14)

Not built. Fabio's own tests of Krea for swapping came back very bad, and Head Swap ships on
Klein 9B distilled int8 instead (MPI-744 checklist 27: Klein 4B, Klein 9B base, Krea and Qwen all
rejected). Fabio closed the whole card, face / head / character swap alike.

The card owned no repo file (bench-only, per its `task.moved` event), so nothing to revert.
`brief.md` stays as the record of the krea2edit node semantics gathered for it.

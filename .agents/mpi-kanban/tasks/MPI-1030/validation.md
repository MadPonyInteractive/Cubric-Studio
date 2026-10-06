# MPI-1030 validation

## Closed without change - by design (Fabio, 2026-10-06)

The second reference encode is the refine (upscale) stage's own conditioning: stage 1 runs
small with `match` so it is fast, the refine runs at full resolution with `max`. The only run
where the two encodes are identical is a text-only one, which is rare on this model. Nothing
to change; options A1-A3 and B in `brief.md` are not pursued.

## Kept as context

The 25 GB disk re-read on the second encode comes from the `MpiClearVram` between the two
encodes discarding the pinned encoder (`brief.md` § Cause). That is the same "load after a
Clean/Unload" the MPI-1029 lead names (ComfyUI#15352); it belongs to that card if the fault
repeats, not to this one.

No code, workflow or node changed. Evidence: `brief.md` (log timings, ComfyUI source).

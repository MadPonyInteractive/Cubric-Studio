# MPI-1175 validation

## Cause

Use Tiles (`ImpactMakeTileSEGS` -> `DetailerForEachPipe`) prints no tile total. Impact prints
`# of Detected SEGS: N` only from `mask_to_segs`, which the tile node never calls, so the
status bar counted stages bare ("Upscaling · 3").

## Fix

`commandExecutor._tileStages` passes `tileCount()` (the count the prompt box already shows)
as the stage total when `Input_Tile_Upscale` is on.

## Evidence

- Bars per tile, from a real run (app.log 2026-10-18 07:32, Krea 2 Use Tiles at 1x): 4 tiles,
  one 0/3 sampler bar each, no load bar, no pass after.
- Every one of the 12 tile graphs runs `cycle: 1`.
- `tests/tile-count.test.cjs`: one bar per tile reads 1/N .. N/N. `npm test`: 3402 pass, 0 fail.
- Fabio eye-tested 2026-10-18: status bar read "UPSCALING · 1/4" on a Krea 2 Use Tiles run.
- Shipped in df410bea8.
- CI run 39108724118 green on df410bea8.

# MPI-1106 brief

GIF and sheet jobs show in the queue (umbrella MPI-1102, "no silent work").

## Noticed

- `isMaskTrackOp` (commandExecutor.js) lists `gifCutoutSam3` / `gifCutoutBirefnet` by hand because MPI-1101 held `js/data/commandRegistry.js`; an `outputKind: 'masks'` on those two entries is the better home once it is free.

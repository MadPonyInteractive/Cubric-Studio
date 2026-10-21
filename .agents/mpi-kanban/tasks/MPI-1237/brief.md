# MPI-1237 - Cosmo knows the tile count

## Seen (Fabio, 2026-10-21)

During a Use Tiles upscale Fabio asked Cosmo how many tiles: Cosmo said ~25, the status bar said 40.
Cosmo is never told the count - its tool text only says "redraw in 1024 px tiles"
(`services/agentLoop.mjs:122`, `docs/agent/upscaling.md`), so it guessed. The real number is
`js/utils/tileCount.js` (Impact `MakeTileSEGS` maths on the OUTPUT size: overlap + cloud-mask
padding make it higher than size / 1024 suggests). The prompt box label and the status bar's
Tile x/n (MPI-1175) already use it.

## Two ways out (Fabio)

1. **Cosmo knows exactly** - the same `tileCount()` number reaches it (the generate result for a
   tiled run, and/or describe_model / a pre-run line), and it answers with it.
2. **Cosmo says where to look** - "the status bar shows the tile count" - never a number it made up.

My pick: 1, with 2 as the fallback when it has no count (a run it did not start, a picture it has
not measured). Either way, no guessed number.

## Carries into MPI-1232

Tile size + dynamic overlap change the count; whatever feeds Cosmo must call the same function
with the same options as the label.

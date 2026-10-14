# MPI-1139 checklist

- [~] Reproduce in the SHIPPED single-guide path. NOT run: the GPU had 14.7 GB in use (2026-10-14), the
      repro agent stopped by its safety rule. Code trace confirms the mechanism (research/repro.md): a
      736x1308 portrait padded to 960x512 by #903 is ~70% black. Note the MPI-1096 all-black clip was a
      THREE-guide bench, not this path, so the clip-level harm here is inferred, not seen.
- [x] Fix (38b1d9d9c): one picture goes through the sheet composer (grey card, clip-shaped), both engines
      (the composer runs before upload). `tests/ingredients-sheet.test.cjs` 12/12, new portrait case.
- [x] CI green on 38b1d9d9c.
- [ ] Fabio's eye check in his app: LTX Reference to Video, ONE portrait picture, landscape clip.

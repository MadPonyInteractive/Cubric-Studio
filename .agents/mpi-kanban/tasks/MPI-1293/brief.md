# MPI-1293 Brief

Fabio 2026-10-25: one Stop press in a Flow stops everything queued for that Flow. See plan.md.

## Noticed
- 2026-10-26 claim audit: a Stop before a driver's first job reads a blank status (MpiBaseFlow driver settle, `!out` tested before `stopped`) and, on Storyboard's cast path, a "panel 1 was refused" warning toast. Cosmetic; handed to the MpiBaseFlow owner (MPI-1294) and Storyboard 22.

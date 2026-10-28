# MPI-1324 validation

Shipped da38359fa. Injection gate green on all five graphs, npm test 3791 pass / 0 fail, lint clean.

Live, 2026-10-28, local RTX 4060 Ti 16 GB, app:isolated on the real engine, one run per Flow (Fabio yes). All succeeded; ComfyUI /history shows each MpiClearVram executed, not cached. GPU memory used after each run (MiB):

| Flow | secs | before | after |
|---|---|---|---|
| voice-changer | 12 | 883 | 906 |
| transcribe | 10 | 1057 | 1113 |
| ltx-foley | 119 | 1117 | 835 |
| ltx-extend | 253 | 835 | 916 |
| pano-360 | 129 | 897 | 1283 (14.5 GB mid-run) |

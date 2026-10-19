# MPI-1197 Checklist

- [x] Cause narrowed: template 6 holds the picture pose then plays the clip shifted (F, A, D, W1, W2)
- [x] Fix: 17-frame still lead-in cut from the result (nodes 36-47, 123), builder + API + raw
- [x] Validator + 50 workflow tests
- [x] Bench V1 (_009) and V2 (_006 run) in step
- [x] Fabio eye test in the app: re-run of _009 in sync with the music (2026-10-19)
- [x] CI 39196400277 green on ca982394f

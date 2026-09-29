# MPI-991 checklist

- [x] On-card App state line gives the exact way to the Mask tool and bans the gallery
- [x] Masking rule loses its "skip the first half" conditional (system prompt stays under budget)
- [x] `docs/agent/masking.md` step 2 says the same
- [x] Tests updated: `tests/agent-loop.test.cjs`, `tests/agent-prompt-budget.test.cjs` green
- [x] Live: Fabio 2026-09-29, buttons shown, no gallery step
- [x] Route rule ends on `[options: Mask | Whole-picture edit]`, painting directions only after Mask (8474e9b69)

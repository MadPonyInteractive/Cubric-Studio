# MPI-1219 validation

- node --test tests/agent-corpus.test.cjs tests/agent-prompt-budget.test.cjs tests/recipe-registry.test.cjs: 9 pass, 0 fail.
- Evidence: Flux 3 tests project sidecars, 2026-10-21. Cosmo ~150-word detail prompt failed on flux3-klein (00:24-00:30) and qwen-image-2-1 (00:31 x2); "hand over arm" on qwen-image-2-1 at 00:32 fixed the hand.
- Reopened: added detail denoise bands from Fabio (0.3-0.5 add detail, 0.6-0.75 change structure; high detail as a faster inpaint). Corpus tests 9/9 green.

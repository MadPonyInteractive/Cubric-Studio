# MPI-1144 checklist

- [x] Engine input/output emptied once, at engine spawn (nothing can hold them then); a locked entry warns and stays until the next start
- [x] Quit-time cleans removed in both twins (main.js before-quit, routes/shared.js installShutdown) with the engine-owner IPC that only fed them
- [x] tests/engine-scratch.test.cjs covers the new contract, incl. a locked entry not throwing
- [x] docs/worktrees.md updated; Fabio said yes to .claude/rules/comfy_injection_multistage.md

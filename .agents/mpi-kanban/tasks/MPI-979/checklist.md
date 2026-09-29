# MPI-979 Checklist

- [x] Root cause found in the log and reproduced offline (mp4 through `_readReference`)
- [x] `resolveAgentMedia` refuses a ref whose file type contradicts its slot
- [x] Regression test in `tests/agent-generation-relay.test.cjs`
- [x] Related suites green locally (435 pass, 0 fail), eslint clean
- [x] CI green on 772e9baf1 (Tests run, 2026-09-29)

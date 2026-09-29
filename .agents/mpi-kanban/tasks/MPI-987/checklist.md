# MPI-987 checklist

- [x] App state line, masked clause: whatever the user says they painted is this mask (dictation mishears), and painting on this entry chose it: run on it, never send them to repaint elsewhere (48611f4d8)
- [x] Unit test pins both sentences (`tests/agent-loop.test.cjs`)
- [x] `tests/agent-prompt-budget.test.cjs` still green (155 pass, 0 fail with agent-loop)
- [x] Finding recorded in `docs/agent-findings.md`
- [x] Live check: declined by Fabio 2026-09-29 (see validation.md)

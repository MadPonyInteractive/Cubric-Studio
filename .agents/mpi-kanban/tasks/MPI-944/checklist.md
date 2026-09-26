# MPI-944 checklist

- [x] Boogu notes (`modelPriority.js`, both tiers) say it cannot bring content in from another picture, and name the editors that can
- [x] `docs/agent/models/flux-2.md` Pick it when: second-image line names kleinEdit / krea2Edit when Qwen is not installed, plus the load order
- [x] Three cases in `scripts/agent-test.mjs` (`second-picture-room`, `second-picture-room-every-editor`, `second-picture-character`), 3/3 each
- [x] `--bite` on the three cases: every flip fails
- [x] `tests/model-priority.test.cjs` + `tests/agent-prompt-budget.test.cjs` green
- [x] Finding in `docs/agent-findings.md`
- [ ] Committed, pushed, CI green

# MPI-1257 validation

- 2026-10-23 people-words guard: node --test tests/tile-describe.test.cjs 6/6 pass (live names curly gray hair and beard / a man's shoulder and neck now dropped; armchair/headland/shells kept). npm test 3549 pass 0 fail; eslint clean on the 4 files.
- Hover (PromptBoxControls tileDescribe info) + commandRegistry help now say a name that mentions a person is dropped.
- Paid naming: Fabio set the line at $0.01 (2026-10-23). nameTiles sums each /llm/describe costUsd, logs it always, generationService toasts it (ui:info) past $0.01. Test: 15 tiles x $0.001 = $0.015, free describer reports no cost. node --test tile-describe 7/7, npm test 3550 pass 0 fail, eslint clean. Not run live (a paid run spends money); the toast line is a one-line threshold.
- Committed 159b53e4d (code + test). Closed on the unit tests above; the paid toast is a one-line threshold, not run live.

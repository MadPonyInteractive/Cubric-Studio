# MPI-805 — checklist

- [x] `'engine:restart'` documented in `js/events.js`
- [x] `navigation.js` subscribes it to the existing `_restartEngine` (handler untouched)
- [x] Restart engine plate at the end of Settings → External Connections
- [x] The model-folder toast names the button
- [x] `npm test` 1321/1320 pass 0 fail, `lint:components` + shell eslint clean
- [x] Fabio pressed it mid-generation (2026-09-18) — button works, but the toast took ~30s, so he
  pressed twice and got two. Reopened the card
- [x] The 30s silence fixed at BOTH call sites (`_restartEngine`, `repairPythonDeps`): one probe,
  answer now. Busy → the restart is SCHEDULED, not refused (his call); second press does not arm
  a second waiter. `engine-restart-schedule.test.cjs` 6/6, `npm test` 1329/1328, eslint clean
- [ ] Fabio: re-check — generation running, add a folder, press Restart engine. Scheduled toast at
  once, engine restarts by itself when the generation ends or is cancelled

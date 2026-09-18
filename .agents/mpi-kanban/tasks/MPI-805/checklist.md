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
- [x] Fabio re-checked (2026-09-18) — scheduled toast at once, then "Restarting the engine…" fired
  by itself when he cancelled. Both branches live
- [x] Plate copy no longer says a restart is "refused"; it says the restart waits

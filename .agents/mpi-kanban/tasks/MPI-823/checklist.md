# MPI-823 — checklist

- [x] `DEFAULT_PROMPT_REUSE_OPTIONS` carries `video` and `audio`
- [x] `normalizePromptReuseOptions` keeps `video` and `audio` (same `!== false` default-ON rule as the other parts)
- [x] A round-trip test through the REAL `js/core/storage.js` proves an unticked part survives
- [x] The test is driven by `REUSE_PARTS`' own key list, so a seventh part cannot be added without the store learning it
- [x] Proven RED on pre-fix code (`js/core/storage.js` from HEAD, test file untouched — `fail 2`)
- [x] `npm test` green — 1411 tests, pass 1410, fail 0, 1 skipped, exit 0

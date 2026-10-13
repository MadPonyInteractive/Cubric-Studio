# MPI-1127 validation

2026-10-13 (session 0775ef72):
- `node --test tests/agent-loop.test.cjs` -> 191 pass, 0 fail. New: a Flow id gets the install
  card (size 13.4, licence true, only measured before Yes), Yes calls installFlow(id, true) and
  never installModel; No starts nothing; NO_ENGINE gives no card and never names install_engine.
- `node --test --test-concurrency=1 tests/agent-*.test.cjs tests/mcp.test.cjs tests/flow-licence-surface.test.cjs`
  -> all pass after trimming (first run: tool schemas 23 bytes over budget, flows.md 202 lines; both fixed,
  `tests/agent-prompt-budget.test.cjs` 7/7).
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/agent-chat.spec.js -g "confirm card Yes"`
  -> 1 passed: the card reads "Download: 4.2 GB. A licence screen opens first." in a real Electron run.
- `npx eslint` on the changed JS -> clean.
- Not run: a live Cosmo turn on DeepInfra (costs money; the tool path is covered above).

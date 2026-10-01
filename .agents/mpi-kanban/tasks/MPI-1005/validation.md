# MPI-1005 Validation

## Automated (2026-10-01, session 585dd02b)

- `node --test tests/agent-*.test.cjs tests/connector-agent-tools.test.cjs tests/connector-flow-dispatch.test.cjs tests/llm-agent-context.test.cjs`
  -> 487 tests, 486 pass, 0 fail, 1 skipped (pre-existing skip).
  New: `tests/agent-loop.test.cjs` § "MPI-1005 — the review card" (10 tests): card emitted with the
  field's text and nothing run; Review opens, Just do it runs once, each with ONE model call total;
  a refused run goes back to the model; a typed reply / reset runs nothing; a boolean on a review
  card is refused (`ok: false`, card still pending; the code is `BAD_CHOICE` in `confirm()`, not
  asserted) and 'run' on an install card is asserted `BAD_CHOICE`; `open: true` and a Flow without a review
  raise no card; a queued (non-wake) message answers a review card as 'replied', never a spend card.
  `tests/agent-flow-handover.test.cjs`: Song declares `agentReview: 'Input_Lyrics'`, a real field.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/agent-chat.spec.js -g "review card"`
  -> pass (isolated Electron, port 55707): box shows the lyrics, buttons "Review lyrics" / "Just do
  it", click posts `{ confirmId, choice: 'review' }` and shows "Opened for you to review.", a typed
  send disables the buttons, an answered history entry redraws read-only with "Started.".
- Full `tests/desktop/agent-chat.spec.js`: 36 passed (2.8 min), so the yes/no cards, options and
  history redraw are unchanged.
- `npx eslint` on the changed renderer files: clean.

## Fabio (2026-10-01)

- Live look: "1" (the card looks and acts right).
- Cut-off default to the max for everyone: "yes". Song's `Input_Duration` default 300 -> 360;
  pinned by `tests/agent-flow-handover.test.cjs` ("Song's cut-off defaults to its maximum").
  After it: `node --test tests/agent-*.test.cjs tests/connector-*.test.cjs (agent-tools, flow-dispatch)
  tests/llm-agent-context.test.cjs tests/flow-*.test.cjs` -> 661 tests, 0 fail once the new pin read
  the run step's `fields` (the field is not on a middle step).

## CI (2026-10-01, session 314c5ced)

- Run 36828363130 on the code commit 2eb6bea46: RED. `tests/user-flows.test.cjs:149` "every shipped
  Flow, expressed as a package, validates": `minimax-music: flow.agentReview is not a Flow field.`
  The user-package key allowlist (`services/userFlows.js` FLOW_KEYS) never got the new key; the
  local runs above covered `agent-*`/`flow-*`, not `user-flows`. The desktop job was skipped.
- Fix 79e7e7006 (key added to FLOW_KEYS + `docs/flow-packages.md`). Local `npm test`: 2605 tests,
  0 fail. Run 36829690433: success, unit + desktop 4/4 (the first CI judgement of the desktop specs).

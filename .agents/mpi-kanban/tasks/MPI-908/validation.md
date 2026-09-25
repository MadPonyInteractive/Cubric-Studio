# MPI-908 Validation

Verify mode: user-ux. Fabio checks each spot live.

## Phase 1 - Cosmo notices a failure

2026-09-25 automated, PASSED:
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/agent-chat.spec.js` 33/33 incl. the
  new "Cosmo flags a refused tool, a failed job, a redo and a dead turn" (+ gallery-generating-mascot 1/1).
- `node --test tests/agent-loop.test.cjs tests/agent-prompt-budget.test.cjs`: 119 pass, 0 fail (1 live skip),
  incl. the new "a refused tool and a redo are marked on their agent:tool frames"; tool schemas under budget.
- eslint clean on MpiAgentChat.js, heroCrew.js, agentLoop.mjs.

Found and fixed on the way (root cause, shared primitive): `heroCrew.js` `handOverClip`'s 250ms
fallback drop from an OLDER handover blacked out the clip when the same pair swapped straight back
inside the bound (A->B, B->A): both were live again, so the class check passed and it paused the
new clip. Now each handover stamps both clips (WeakMap) and a stale drop no-ops. The new desktop
case failed on exactly this before the fix. Covers landing crew, agent panel, generating card.

Fabio's live check, round 1 (2026-09-25): a refused animate + an unavailable model ended on
answer-ready, which read as happy. Two causes: (1) his app's SERVER was never restarted (app.log
runs unbroken from 2026-09-24T19:26Z), so the new `refused`/`redo` frames were not being sent -
a window reload does not reload agentLoop.mjs; (2) a turn that hit a failure still ended on the
cheerful answer-ready. Fixed (2): `_turnFailed` - such a turn ends on heads-up. Spec extended,
agent-chat 33/33 + 7 more specs 40/40 green. Open: the agent declining IN WORDS with no tool
failing (his "Z Image Turbo" ask) carries no signal at all - asked Fabio.

## Phase 2 - Empty states

2026-09-25 automated, PASSED:
- New `tests/desktop/empty-state-mascots.spec.js` 1/1: the `object-view-box` crop really changes the
  laid-out size (64px-tall no-results = 72px wide, peek = 144px), muted/loop/autoplay set; gallery
  "No cards match" under a videos-only filter plays `video/no-results`.
- Regression, same config: flow-library-filters, flow-library-skips-drawer, flow-packages,
  flow-queue-hotkey, flow-uninstall-button, gallery-archive, gallery-audio-waveform,
  gallery-filter-panel, landing-grid-release, media-picker-cards, media-picker-to-history,
  radial-menu, landing-crew: 29/29.
- eslint clean on every touched JS file.

Fabio's live check: pending.

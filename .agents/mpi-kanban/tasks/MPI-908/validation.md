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

## Double frame on a mascot swap (found by Fabio, from the MPI-777 fix)

2026-09-25 automated, PASSED (session b13c4313):
- Cause: `handOverClip` kept the old clip live until the new one's NEXT frame (to hide the 0 -> 1
  blank frame), so both alpha clips showed at once on a mid-clip swap (hover greet).
- Fix: hidden clip at `opacity: 0.001` (landing.css, MpiAgentChat.css, MpiGalleryGrid.css), and
  `handOverClip` flips both classes in the same frame (rVFC drop / 250ms bound / WeakMap removed).
- Proof on screencast frames (temp probe zz-flicker-probe.spec.js; earlier BEFORE run was taken
  behind the 18+ gate, probe now clicks through gate + What's New): BEFORE strip shows Lingo and
  Prism with two poses stacked for ~4 frames (~100ms) after a greet flip; AFTER strips over 10
  flips show a clean one-frame cut, no stacked pose, no blank (analyser: 0 blinks; its 1 spike was
  Reel's arm crossing Vinyl's corner, checked by eye).
- agent-chat (now strict: exactly one live Cosmo clip), gallery-generating-mascot,
  empty-state-mascots: 35/35. eslint clean.

Fabio's live check (2026-09-25): VERIFIED - "No more flickering and no more overlaps." Probe deleted.

## Reply marker, docs, GIF re-cuts (2026-09-25, session b13c4313)

Automated, PASSED:
- Reply marker: agentLoop.mjs Declining rule ("start that reply with [declined]"); the final-text path strips
  it from the shown + stored text, keeps it in model context, and flags `declined: true` on agent:message.
  MpiAgentChat sets `_turnFailed` from it, so the turn ends on heads-up. node agent-loop + prompt-budget
  120/120 (new "Declining" test; SYSTEM_BUDGET raised 9,800 -> 9,950, measured 9,880); desktop
  "Cosmo flags ... a declined reply" case passes; eslint clean.
- Docs: DESIGN.md Mascot rules (clips not PNGs, op's mascot per spot, three playback paths, 320px
  no-results exception); docs/mascot-placement.md spot map (generating card built, float dropped, empty
  states + agent fail rows); docs/shell.md handOverClip.
- GIF re-cuts: dot-marked gif_011/012/013 -> manifest re-pointed to gif_69186173/72/77; restaged
  vision/getting-ready, vision/working, studio/getting-ready (the other 7 re-encodes were same-size
  header noise, restored from HEAD); `--verify` rim check passed; frame 15 over magenta shows the white
  bits gone.

Fabio's live check (2026-09-25, after a full restart): "1". His Z Image Turbo ask was NOT declined - the agent substituted FLUX.2 Klein 9B and generated - so the declined path did not fire live; it is covered by the node + desktop tests only. No marker text leaked, the normal turn ended normally. GIF re-cuts accepted.

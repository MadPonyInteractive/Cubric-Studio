# MPI-1012 validation

Verify mode: user-ux. Evidence per phase lands here; Fabio's look closes it.

## P1 colours (8d543e4d6)

- `tests/media-head-colours.test.cjs`; npm test 2674/0; CI green on 8d543e4d6 (run 37045344035).

## P2 + P3 (session 3fabe4ef, 2026-10-02)

- `npm test`: 2687 tests, 2685 pass, 0 fail (2 skipped).
- New `tests/audio-models.test.cjs` (10 cases): both ModelDefs carry the Flows' exact dep ids,
  graphs + stills on disk; Flows gone, ops tombstoned in BOTH registries; `stable-audio-3`
  gated by the SAME descriptor (id + version 1); every injected key is a graph title/widget;
  English -> English arm, all others multilingual; agent runs inject defaults (not the
  graph's bake: Chatterbox bakes the multilingual arm); describe_model lists categories /
  languages / 1-190; audio never writes a shared bucket; an old Flow submit / routine step
  runs as the model; Reuse on an old Flow card opens the model with its voice and language.
- Retargeted off the dead exemplars: agent-corpus, recipe-registry, agent-duration,
  agent-flow-handover, agent-voice-library, connector-flow-dispatch, flow-derived-fields
  (fixture), flow-uninstall-guard, inject-params-titles, smoke-flows, agent-prompt-budget.
- `npm run release:check`: op parity green; red only on the known 1.6.x archival notes.
- eslint on every touched JS file: clean.
- Desktop specs touched (flow-library-filters, flow-pick-voice, agent-chat): 39/39 passed
  locally through `playwright.desktop.config.js` (own port + userData).
- CI on c0b04e095: run 37050434172, unit + desktop (1-4) all `success` (2026-10-02 19:08Z).

## P4 prompt box voice (session a8d03bbe, 2026-10-02)

- `node --test "tests/**/*.test.cjs"`: 2688 tests, 2686 pass, 0 fail (2 skipped).
- New case in `tests/audio-models.test.cjs`: `tts` unavailable with no audio staged
  (`requiresAudio` 1), available with `audioCount: 1`, and no other op of any model waits on
  audio. Bites: deleting `audioCount >= requiresAudio` from `getAvailableCommands` fails it.
- New `tests/desktop/prompt-box-voice.spec.js` (gallery box): `+` reads "Add a voice" on
  Chatterbox and opens the picker on audio with the voice-library and mic cards; tts is
  `aria-disabled` with "needs a voice" until a voice is injected; no `+` on Stable Audio 3;
  "Add a reference image" back on SDXL. Bites twice: without the weightless-runner pin the box
  never mounts; with `_voiceSlot()` returning null the label assertion fails.
- `npx playwright test --config=playwright.desktop.config.js` on prompt-box-voice +
  media-picker-to-history + media-picker-cards + gallery-stack-run + flow-pick-voice: all pass.
- eslint on every touched file: clean.

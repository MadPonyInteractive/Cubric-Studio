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

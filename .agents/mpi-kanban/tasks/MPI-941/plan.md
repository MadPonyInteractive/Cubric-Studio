# MPI-941 plan - in-app agent umbrella 2

**Order, Fabio 2026-09-26: this card STARTS AFTER MPI-817 CLOSES.** He wants the old agent
umbrella finished first, then this one, passed from session to session by handoff. Do not
move this card to `doing` while MPI-817 is still open.

## Members

| Phase | Card | Title |
|---|---|---|
| 1 | none (orphan) | `look` sees videos and GIFs |
| 2 | MPI-904 | Agent image tools: plain enlarge, background removal and crop |
| 3 | MPI-913 | Agent on local Ollama holds VRAM while its own generations run |
| 4 | MPI-905 | Warn when the agent's model has under 64K context |

The member cards stay on the board until their work lands here (umbrella rule). Their
`task.json` descriptions hold the diagnosis; this plan holds the order and ownership.

## Phases

### Phase 1 - `look` sees videos and GIFs (orphan: message a082a6a6, MPI-593 session)

`services/cardView.js` `viewFile(absPath, { frames: 6 })` is committed in `3bb7c58d`, with
`tests/card-view.test.cjs`. For a still it returns `{ kind: 'image', data }`. For a video or
GIF it returns `{ kind: 'video', data: <one webp contact sheet>, times, columns, duration,
hasAudio }`. In `look` (`services/agentLoop.mjs`, `case 'look'` ~1777): when the ref is a
video or GIF, write the sheet to `cropDir()` as `.webp`, then send it to
`/connector/describe`. The question starts: "This is a contact sheet of <n> frames from a
<duration>s clip, <columns> per row, left to right then top to bottom, at <times>." That is
one describe call per clip, the same cost as a still. Then drop the three "cannot" lines:
the Looking rule (~1417 "it cannot open a video"), the honest limits (~1437 "I cannot watch
videos, see a GIF move"), and the attachment line (~2104 "look cannot open a video"). Keep
"sound is not heard".
**Budget:** the system prompt sits at 10,149 of 10,150 bytes (`tests/agent-prompt-budget.test.cjs`),
so the replacement text must be shorter than what it removes. Run `npm test`, not a subset.
**Verify:** a unit test for the video branch with viewFile stubbed; then live, ask the agent
what happens in a clip.

### Phase 2 - MPI-904: enlarge, remove background, crop with no model

This card is still `idea`, so plan it first. Its description gives the shape: expose resize,
imageUpscale and removeBackground as catalogue ops that `generate` runs with no modelId, each
landing as a new entry on the source card, so the tool schema does not grow. Footprint to
confirm while planning: `services/agentLoop.mjs` (catalogue and generate), `routes/connector.js`
(generate needs a modelId today), the crop-media route (it writes a file with no card entry).

### Phase 3 - MPI-913: release local Ollama before the agent's own local generation

Its description has the fix and the order in which to check things. Check first whether the
agent turn already blocks on the generation. Footprint: `services/agentLoop.mjs`, the agent
routes, and `routes/llm.js` `releaseOwnModels` (reuse it, do not copy it). The copy for "Cosmo
is waiting" is Fabio's draft, so show it to him before it ships.

### Phase 4 - MPI-905: 64K context floor

Two parts. `services/llmEngines.mjs` `OLLAMA_AGENT_CONTEXT` goes from 32K to 64K. The agent
probe in `MpiLlmSettings` reports the context window and warns under 64K, using
`_contextWindowFor`. No `agentLoop.mjs` edit is expected.

## Parallel Batch - Phase 1 and Phase 4

- **Phase 1** - Ownership: `services/agentLoop.mjs`, `tests/agent-loop.test.cjs` (or a new
  `tests/agent-look-clip.test.cjs`), `docs/agent-chat.md`.
  **Verify:** `npm test`, plus a live clip look.
- **Phase 4** - Ownership: `services/llmEngines.mjs`, the `MpiLlmSettings` component files,
  its test. **Verify:** `npm test`, plus the probe warning seen in the app.

Phases 2 and 3 both edit `services/agentLoop.mjs`, as Phase 1 does, so they run one after
another after it and never in a batch with it.

## Current State

2026-09-26: created by the MPI-867 close-out session (8db368e3). Nothing built. It waits for
MPI-817 to close.

## Plan Drift

(none yet)

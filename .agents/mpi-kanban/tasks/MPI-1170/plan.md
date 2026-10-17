# MPI-1170 Plan: Cosmo understands video (umbrella)

## Current State

- Project mode: scalable-foundation.
- Brainstormed with Fabio 2026-10-17. Trigger: the photographer tester showed Cosmo a camera-move clip and
  Cosmo could not read it from a 6-frame contact sheet. The camera-reference half of that is MPI-1164
  (Cosmo passes the clip as a reference, no watching).
- **Scope, cut by Fabio 2026-10-17: MCP viewing + Cosmo listening, nothing else.** Cosmo's viewing
  stays at 6 frames. Everything about long videos, video-input models and a vision chat model moved to
  MPI-1134 "Story and Infinite Video (umbrella)" Phase 5b — a story's clips carry their own prompts,
  which come first; watching matters most for imported footage.
- Research facts (2026-10-17): both describers take one image per call, capped at 1 MP
  (`routes/llm.js:439`, `comfy_workflows/image_descriptor.json` node 41); Cosmo's chat model is
  text-only; speech-to-text exists three ways — DeepInfra `POST /deepinfra/transcribe`
  (`routes/deepinfra.js:757`, 25 MB / 60 s), Ollama `POST /llm/transcribe` (`routes/llm.js:703`),
  ComfyUI `MpiSpeechToText` qwen3-asr in the Transcribe Flow (`js/data/flowsRegistry.js:2213`), which
  Fabio rates good and light on VRAM.

## Members

- **MPI-1168 "Smarter clip viewing"** — MCP `view_card`: scene-change pick, near-dup drop, `from`/`to`,
  separate frames. Plan: `tasks/MPI-1168/plan.md`.
- **MPI-1169 "Cosmo hears clip audio"** — a clip with sound is transcribed through the transcriber the
  user has selected, and Cosmo reads the words with its 6 frames. Also carries the one line Fabio asked
  for: when 6 frames are not enough, Cosmo says it views only 6 to stay cheap and that MCP can look
  closer. Plan: written when the card is picked up (`mpi-create-plan`).

## Completed

- [x] Brainstorm, Watch-skill + describer + DeepInfra + Story research (2026-10-17).

## Remaining Work

## Parallel Batch: Phase 1 — both members — `auto` / `user-ux`

The two footprints are disjoint; run with `mpi-execute-parallel`, or one after the other.

- [ ] **1A MPI-1168 MCP clip viewing.** Ownership: `services/cardView.js`, `routes/mcp.js`,
  `tests/card-view.test.cjs`, `tests/mcp.test.cjs`, `docs/mcp-server.md`.
  Briefings: Critical Rules Snapshot, `.claude/rules/root-cause.md` § Sub-Agent Briefing.
  **Verify:** per `tasks/MPI-1168/plan.md` (auto).
- [ ] **1B MPI-1169 Cosmo hears clip audio.** Ownership (provisional, confirmed by its own plan):
  `services/agentLoop.mjs`, `services/agentTools.mjs`, `tests/agent-loop.test.cjs`,
  `tests/agent-prompt-budget.test.cjs`, `docs/agent-chat.md`. Reads `viewFile`'s `hasAudio`, never
  edits `cardView.js`. `agentLoop.mjs` + the budget test were claimed by a live peer on 2026-10-17:
  check the claim first. Open decision for its plan: how "the selected transcriber" is resolved (a
  Settings pick if one exists, else follow the describe backend: Remote -> DeepInfra STT, ComfyUI ->
  MpiSpeechToText), and what happens past DeepInfra's 60 s cap.
  Briefings: Critical Rules Snapshot, "Every action shows itself" (a transcription is visible work).
  **Verify:** agent-loop test — a clip with audio yields frames + transcript in one `look` result,
  the budget test passes; Fabio hears-and-checks one clip in the isolated app (`user-ux`).

## Plan Drift

- 2026-10-17: started as "Cosmo sees more frames" (slider, chained sheets); cut to MCP + listening.

## Verification

**Verify mode:** user-ux (1B needs Fabio's check on a real clip; 1A is auto).

The umbrella closes when both members are done.

## Preservation Notes

- `docs/mcp-server.md` (view_card) and `docs/agent-chat.md` (look + audio) carry the built facts.
- A new transcription call is local or DeepInfra, both already in the privacy policy — re-check if
  1B adds any other service.

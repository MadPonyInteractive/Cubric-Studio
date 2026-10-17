# MPI-1169 Cosmo hears clip audio

Member of umbrella MPI-1170 "Cosmo understands video".

## Current State

Project mode: scalable-foundation.

- Cosmo looks at a clip through `_describeClip` / `_lookOnce` (`services/agentLoop.mjs:927`, `:953`):
  a 6-frame sheet to the describer. `viewFile` already reports `hasAudio`. The system prompt says
  "I hear no audio" (`agentLoop.mjs:2044`).
- The app already transcribes, three ways, chosen in Settings for DICTATION (MPI-1071):
  `Storage.getDictationBackend()` = `endpoint` (DeepInfra `POST /deepinfra/transcribe`, model
  `Storage.getDictationModel()`: Qwen3-ASR 1.7B $0.00045/min or Whisper Turbo $0.0002/min, 25 MB /
  60 s cap), `ollama` (`POST /llm/transcribe`), `comfy` (`speechTranscribe` op, Qwen3-ASR 0.6B, through
  `enqueueGeneration` — Fabio: good and light on VRAM). The logic lives inside dictation's private
  stop handler (`js/services/dictation.js:160-207`) + `transcribeComfy` (`:218`).
- Looks reach the renderer as `POST /connector/describe` -> `_dispatchToRenderer('agent.describe')`
  (`routes/connector.js:1456`, `js/shell/agentDispatch.js:2183`); transcription follows the same road.
- `services/agentLoop.mjs` + `tests/agent-prompt-budget.test.cjs` are claimed by "Cosmo ref
  understanding 2" (MPI-1164) with uncommitted edits (2026-10-17). Do not start until released.

Decisions (agent picks from Fabio's "pick up whatever model is selected", 2026-10-17 — say if wrong):
- **The transcriber is the dictation pick.** One setting, one place; no new Settings control.
- **Automatic:** a look at a clip with sound also transcribes it. Cost on Remote is the user's own
  key at $0.0002-0.00045 per audio minute; Ollama and ComfyUI are free.
- **Chunks of at most 60 s** (DeepInfra's cap), cut server-side, each line prefixed `[m:ss]` with the
  chunk's ABSOLUTE start, so long clips work on every backend.
- **Cached** beside the plain look in the sidecar (`look.transcript`), same rule as `look.text`:
  cards only, never an attachment.
- **Not set up** (no key, plugin not installed, Ollama off): the look still returns the frames and says
  in one line it could not hear the clip and where to set up Speech to text. Never an error.
- No speech (music, effects): "no words heard", not the transcriber's guess.
- **The MCP pointer (Fabio):** the "I hear no audio" prompt line becomes: Cosmo sees a clip as 6 frames
  to stay cheap; to look closer the user can open it in an MCP client (Claude) with `view_card`.

## Implementation

- [ ] Implement the planned change end to end:
  1. `js/services/dictation.js`: lift the backend switch out of the stop handler into an exported
     `transcribeBlob(blob)` -> `{ok, text?, error?, cancelled?}` (status bar for Remote/Ollama as today;
     ComfyUI through the queue). Dictation calls it; behaviour unchanged.
  2. `routes/connector.js`: `POST /connector/transcribe { path }` — ffmpeg cuts the audio into <= 60 s
     mono 16 kHz pieces in the agent crops dir, dispatches each to the renderer's `agent.transcribe`,
     joins `[m:ss] text` lines. Errors: BAD_REQUEST, FILE_NOT_FOUND, NO_AUDIO, NOT_SET_UP, RUNTIME_ERROR.
  3. `js/shell/agentDispatch.js`: `agent.transcribe({ audioPath })` -> fetch the piece -> `transcribeBlob`.
  4. `services/agentTools.mjs`: `transcribe(path)` + transcript in `storeLook`/`storedLook`.
  5. `services/agentLoop.mjs`: `_describeClip`/`_lookOnce` append the transcript when `hasAudio`; the
     prompt line from the decisions above.
  6. Tests: `tests/connector-transcribe.test.cjs` (new: chunking a 130 s clip -> 3 pieces with 0/60/120
     offsets, a silent clip -> NO_AUDIO), `tests/agent-loop.test.cjs` (a clip with audio -> frames +
     transcript in one result; not-set-up -> one line, no error; cached second look makes no call),
     `tests/agent-prompt-budget.test.cjs` re-run (raise nothing: reword to fit).
  **Verify:** the three test files green, plus `node --test tests/dictation*.test.cjs` if present; then
  on `npm run app:isolated`, Cosmo looks at a clip with a spoken line on each backend Fabio uses.

## Completed

- [x] 2026-10-17 code written (handoff commit), NOT yet covered by new tests:
  `services/clipAudio.js` (new: `cutAudio(file, dir)` -> <=60 s mono 16 kHz WAV pieces + start, null
  = no sound; `stamp`), `routes/connector.js` `POST /connector/transcribe`, `js/services/dictation.js`
  (`transcriberMissing()`, `transcribeBlob(blob)` — dictation's `_finish` now calls it),
  `js/shell/agentDispatch.js` `agent.transcribe`, `services/agentTools.mjs` (`transcribe`,
  `storedHeard`, `storeHeard` -> sidecar `heard: {text, audio, at}`), `services/agentLoop.mjs`
  (`_hearClip`, `_describeClip` appends "Heard:" and returns `output.seen`, `_lookOnce` keeps `seen`
  and hears on a cached look; limits line now "I see a clip as 6 frames to stay cheap, and hear its
  speech. MCP view_card shows more." — byte-neutral, 88 = 88).
- [x] Existing suites green with these edits: agent-loop, agent-prompt-budget, mcp, card-view,
  deepinfra-transcribe, llm-transcribe — 256 pass, 1 skipped (live key).

## Remaining Work

- Tests (step 6): `tests/clip-audio.test.cjs` (new; name changed from connector-transcribe) —
  130 s clip with `sine` audio -> 3 pieces at 0/60/120, silent clip -> null, `stamp(75)` = "1:15";
  `tests/agent-loop.test.cjs` — clip with audio -> "Heard:" lines appended, `storeLook` keeps only
  `seen`; NOT_SET_UP -> "It has sound I could not hear: ..." and nothing kept; NO_AUDIO -> no line,
  `{audio:false}` kept; cached second look -> no transcribe call. Stub `transcribe`/`storedHeard`/
  `storeHeard` in the default tools (makeLoop ~:95); `_hearClip` skips when `transcribe` is absent.
- Then the user-ux check in `npm run app:isolated` (a dialogue clip + a music-only clip) and docs.

## Plan Drift

- 2026-10-17: transcript kept in a sibling sidecar key `heard`, NOT `look.transcript` — the
  update-meta route replaces `look` whole, so a second writer into it would wipe the text.
- 2026-10-17: the cut-into-pieces helper lives in a new `services/clipAudio.js` (testable without a
  renderer), not inline in the route.

## Verification

**Verify mode:** user-ux

Fabio hears-and-checks: a clip with dialogue, one with only music, on the transcriber he has picked.
Own instance only (`npm run app:isolated`), never `:3000`.

## Preservation Notes

- `docs/agent-chat.md` (look hears a clip), `docs/` dictation entry (transcribeBlob is now shared).
- Privacy policy: DeepInfra speech-to-text is already listed (dictation) — confirm the wording covers
  "clips Cosmo looks at", not only "your voice".
- Asks Fabio "Should I update `.claude/rules/`?" at close-out (new renderer capability + route).

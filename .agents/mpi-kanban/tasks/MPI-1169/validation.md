# MPI-1169 Validation

## 2026-10-17 automated (session 9d2acce1)

- `node --test tests/agent-loop.test.cjs tests/agent-prompt-budget.test.cjs tests/clip-audio.test.cjs`
  -> 207 tests, 206 pass, 0 fail, 1 skipped (live key). New: `tests/clip-audio.test.cjs` (130 s clip
  -> pieces at 0/60/120, full piece 60 s, last 10 s by WAV byte size; silent clip -> null; `stamp`),
  agent-loop (k) five cases: sound -> "Heard:" lines + look keeps only `seen` + `heard` stored;
  NOT_SET_UP -> one line, ok, nothing kept; NO_AUDIO -> no line, `{audio:false}` kept; kept `heard`
  -> no transcriber call; sheet `hasAudio:false` -> no call.
- `node --test tests/mcp*.test.cjs tests/card-view.test.cjs tests/deepinfra-transcribe.test.cjs tests/llm-transcribe.test.cjs`
  -> 58 pass, 0 fail.

## 2026-10-17 red master + live bug (session 9d2acce1)

- 77149de3e: CI run 39048384115 red on 9359ef377: bench `fakeTools` lacked transcribe/storedHeard/
  storeHeard, no-delete allowlist lacked `POST /connector/transcribe`. Both added; 227 pass locally.
- 8b4eeaadd: Fabio's live app toasted "No description was returned." on a clip with music, no speech
  (ComfyUI transcriber; found by the "Cosmo ref understanding 2" session). The shared text-op branch
  read an empty transcript as a failed run. `emptyTextOk` on speechTranscribe -> '' reaches onText.
  `node tests/text-op-completion.test.cjs` ok; in-graph-enhance + output-prompt-capture 77 pass.

## 2026-10-17 user check (Fabio) — PASSED

- Dialogue clip: Cosmo told him what the characters were talking about.
- Music-only clip: Cosmo described lighting, shot type and camera move; no invented words.

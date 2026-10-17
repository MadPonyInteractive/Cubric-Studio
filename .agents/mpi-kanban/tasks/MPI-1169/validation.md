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

## Pending

- Fabio's in-app listening check (`npm run app:isolated`): a dialogue clip + a music-only clip.

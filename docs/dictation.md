# Dictation — speak into the prompt box and the Agent panel (MPI-946)

A mic button beside the prompt box's Enhance and the Agent composer's Send. Click, speak, click
again; or **hold Ctrl+Space**, speak, release. The words land at the caret and are never sent on
the user's behalf.

## The pieces

| Piece | Where |
|---|---|
| Record, send, insert, greyed state | `js/services/dictation.js` — `attachDictation(btn, textarea)` returns the detach fn |
| Route, Remote | `POST /deepinfra/transcribe[?translate=1][&model=qwen\|turbo]` in `routes/deepinfra.js`, body = the recording's bytes |
| Route, Ollama | `POST /llm/transcribe[?translate=1][&words=…]` in `routes/llm.js` (MPI-1071), same body |
| Route, ComfyUI | the `speechTranscribe` op (`comfy_workflows/speech_to_text.json`, MpiSpeechToText + Qwen3-ASR 0.6B), queued by `transcribeComfy()` in `dictation.js`; weights = the `speech-to-text` plugin |
| Where it runs | **Remote panel** (NOT Settings) > Where each job runs > "Speech to text" → `Storage.getDictationBackend()` (`endpoint` \| `ollama` \| `comfy`); set through `setDictationBackend()` in `dictation.js` so the mics re-mark |
| Hotkeys | `dictation.hold` / `dictation.release` / `dictation.release.space` in `hotkeyRegistry.js` |
| English toggle | Settings, Audio, "Dictate in English" → `Storage.getDictationTranslate()` |
| Mounts | `MpiPromptBox` (`#dictate-slot`, after Enhance) and `MpiAgentChat` (`#ac-dictate-slot`, before Send) |

A host mounts a plain `MpiButton` (`mic`) and hands it to the service with its textarea. The
behaviour lives in a service, not a component, because `MpiAgentChat` is a Compound and may
import Primitives only.

## Facts that are not obvious

- **Remote models are a server allowlist** (`STT_MODELS`, MPI-1071): the renderer sends a KEY,
  never an endpoint. Qwen3-ASR 1.7B is the default (benched cleanest on Fabio's clips), Whisper
  Turbo covers the ~70 languages Qwen lacks. A vocabulary hint (`initial_prompt`) does nothing
  for Qwen and makes Turbo drop words, so Remote takes no word list.
- **Ollama = any installed model that hears, Gemma 4 12B the default** (`STT_OLLAMA_MODEL`; pick via
  `GET /llm/transcribe/models` = `audio` in `/api/tags` capabilities, sent as `&model=`, checked by the route).
  Gemma 4 26B and 31B do NOT hear ("Text, Image" on ollama.com/library/gemma4); E2B, E4B, 12B do. Gemma 4 is the only Ollama family with
  the `audio` capability, and Ollama documents no audio field: a 16 kHz mono WAV as bare base64
  in the message's `images`, `think: false`. The route converts the WebM through the bundled
  ffmpeg over pipes. e4b crashed on 8 of 10 clips (Ollama 0.35.1, ollama#15333): not an option.
  `words` IS honoured here: "Words the speaker may use: Cubric Studio." fixed every misspelling.
  ~2 s a clip warm, 8.5 GB of VRAM loaded. Missing model = Ollama's 404 → `NO_MODEL`.
- **Gemma stays WARM between takes; a LOCAL generation clears it** (Fabio, 2026-10-11: a reload
  per take is ~8 s). `comfyController.runWorkflow` POSTs `/llm/ollama/unload` right before a local
  `/prompt` (never for a Pod), so no Ollama model sits beside a generation (MPI-14's reason).
- **ComfyUI = Qwen3-ASR 0.6B through the generation queue** (MPI-1071). The take goes in as a
  `data:` URL that comfyController stages into the engine's input/ (Pod too); its type must lose
  `;codecs=opus` first, because `/comfy/stage-media-data-url` matches `data:<mime>;base64,`. It
  waits behind a running generation, like the ComfyUI describer, and the queue owns the status bar.
  ~6 s the first take (model load), then the model sits in RAM. The mic stays greyed until the
  `speech-to-text` plugin (1.6 GB) is installed; Settings offers the install. Qwen3-ASR cannot
  translate, so "Dictate in English" does nothing here. `Input_Context` (the node's `context`) is
  the dictionary hook: empty today, it spelled "Cubric Studio" right when filled.
- **A renderer probe of this path needs an Electron window**: a playwright-cli page gets CORS 403s
  from the engine. Playwright `_electron` with `CUBRIC_BACKGROUND=1` + own `CUBRIC_PORT` /
  `CUBRIC_USER_DATA_ROOT` attaches to the running engine and runs `transcribeComfy` for real.
- **The status bar shows "Transcribing"** (pulse + clock) on both backends, borrowed only when no
  generation runs and handed back with the silent `cancel()`: `complete()` would book it as one.
- **"Dictate in English" goes to `openai/whisper-large-v3` instead** (~$0.00045/min). Turbo was
  never trained to translate: it accepts `task: translate` and answers in the language spoken.
  Measured 2026-09-27 on a Portuguese clip: turbo translate = the Portuguese transcript, large-v3
  translate = English. The first test of this toggle used ENGLISH audio, which proves nothing —
  test a translate path with non-English speech.
- **The recording goes up as MediaRecorder made it (WebM/Opus).** Whisper decodes it; measured
  2026-09-26, same text as the WAV at a fifth of the bytes. Nothing is saved, so the
  `.webm`-is-video trap that makes `MpiAudioRecorder` re-mux to WAV does not apply.
- **`inference_status.cost` is in CENTS, not dollars.** Voxtral read 0.05475 for 10.95 s, which
  is its catalogue rate in cents (MPI-1071); the "~70x too high" Whisper reading (0.0027 for 11 s)
  was very likely the same misreading (0.0027 cents is in Turbo's range). Never surface it as dollars.
- **No key = greyed, not hidden** (Fabio), on Remote only: Ollama needs no key. `hasCloudKey()` mirrors the main process; the mics
  re-mark on `models:checked`, so saving a key enables them without a reopen.
- **Which box a held Ctrl+Space fills:** the focused one; else the last one focused; else any
  on screen. A zero-width host (the closed Agent panel) is skipped.
- **The release is two entries** because the keyup reads `control+space` when Space is let go
  first and `space` when Ctrl is. Letting go of Ctrl alone keeps recording until Space is up.
  The gates read `data-dictate` on the buttons (`idle | recording | held | busy`).
- **Insertion fires `input`**, so the prompt box saves by mode (positive or a negative) and
  `MpiInput`'s auto-height re-measures, exactly as if typed.
- A take under 300 ms is dropped unsent.
- Privacy: the voice recording going to DeepInfra must stay named on https://cubric.studio/privacy/
  (§ Dictation, Website repo `privacy/index.html`). A change to where it goes makes that page false.
  The Ollama backend sends nothing off the machine, so it leaves that page true.

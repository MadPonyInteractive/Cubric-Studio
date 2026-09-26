# Dictation — speak into the prompt box and the Agent panel (MPI-946)

A mic button beside the prompt box's Enhance and the Agent composer's Send. Click, speak, click
again; or **hold Ctrl+Space**, speak, release. The words land at the caret and are never sent on
the user's behalf.

## The pieces

| Piece | Where |
|---|---|
| Record, send, insert, greyed state | `js/services/dictation.js` — `attachDictation(btn, textarea)` returns the detach fn |
| Route | `POST /deepinfra/transcribe[?translate=1]` in `routes/deepinfra.js`, body = the recording's bytes |
| Hotkeys | `dictation.hold` / `dictation.release` / `dictation.release.space` in `hotkeyRegistry.js` |
| English toggle | Settings, Audio, "Dictate in English" → `Storage.getDictationTranslate()` |
| Mounts | `MpiPromptBox` (`#dictate-slot`, after Enhance) and `MpiAgentChat` (`#ac-dictate-slot`, before Send) |

A host mounts a plain `MpiButton` (`mic`) and hands it to the service with its textarea. The
behaviour lives in a service, not a component, because `MpiAgentChat` is a Compound and may
import Primitives only.

## Facts that are not obvious

- **The model is fixed server-side:** `openai/whisper-large-v3-turbo`, the same rule as
  `/deepinfra/generate` taking a model id: the renderer never names what the key is spent at.
- **The recording goes up as MediaRecorder made it (WebM/Opus).** Whisper decodes it; measured
  2026-09-26, same text as the WAV at a fifth of the bytes. Nothing is saved, so the
  `.webm`-is-video trap that makes `MpiAudioRecorder` re-mux to WAV does not apply.
- **`inference_status.cost` is WRONG for Whisper.** It answered $0.0027 for an 11 s clip while
  the month's usage (`/payment/usage`) booked the same calls at the catalogue 0.000333 cents a
  second, ~70x less. The real price is ~$0.0002 per audio minute. Never surface that field
  for this model.
- **No key = greyed, not hidden** (Fabio). `hasCloudKey()` mirrors the main process; the mics
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

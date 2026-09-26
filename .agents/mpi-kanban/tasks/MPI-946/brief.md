# MPI-946 - Dictation: speak into the agent panel and the prompt box

## Goal (Fabio, 2026-09-26)

A small microphone on the Agent panel's input and on the prompt box. Press it, talk, and what
was said is written into the box, so the user never has to type.

## Decisions (Fabio, 2026-09-26)

- **Provider: DeepInfra speech-to-text**, the only cloud provider the app uses. Model
  `openai/whisper-large-v3-turbo`, about $0.0002 per audio minute, billed on the user's own key.
- **No DeepInfra key: the mic shows greyed out** and says where to add one. It is not hidden.
- **Translate is a toggle** (Settings, beside the Microphone picker). Off = text comes back
  in the language spoken. On = Whisper's `translate` task, any language in, English out.
- **Hold-to-talk shortcut: Ctrl+Space.** T was the first idea, but it types a letter in a
  text box. Hold, speak, release. Clicking the mic starts and stops too.
- Dictated text lands at the cursor and is never sent on its own: the user reads it, then
  presses Enter.

## Shape

- `POST /deepinfra/transcribe` in `routes/deepinfra.js`: the recording in, `{ ok, text, cost }`
  out. The model is fixed on the server, so the renderer cannot pick an endpoint to spend at.
- `js/services/dictation.js`: record, send, insert at the caret. Each host mounts an
  `MpiButton` (`mic` icon) and hands it to the service with its textarea.
- Hosts: `MpiPromptBox` and `MpiAgentChat`.

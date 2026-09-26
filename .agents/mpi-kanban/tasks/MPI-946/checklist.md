# MPI-946 checklist

- [x] `routes/deepinfra.js`: `POST /deepinfra/transcribe` (fixed model, same key resolution and error codes, body never logged)
- [x] `js/services/dictation.js`: record with the Settings microphone, send, insert at the caret, greyed without a key
- [x] `hotkeyRegistry.js` + `mpi-hotkeys.js`: hold Ctrl+Space to talk
- [x] `storage.js` + `MpiSettings`: the translate-to-English toggle
- [x] mount in `MpiPromptBox` (after Enhance: `agent-chat.spec.js` pins Enhance straight after the prompt)
- [x] mount in `MpiAgentChat` (the MPI-943 claim went `complete`, then claimed here)
- [x] test: `tests/deepinfra-transcribe.test.cjs` (5 pass); `npm test` 1995 pass, 0 fail
- [x] live: `_transcribe` against DeepInfra with Fabio's key - exact text back; a bad key maps to NO_KEY
- [x] live, `app:isolated` renderer: greyed + "needs a key" with no key; key appears -> enabled via `models:checked`; click record -> real route -> NO_KEY toast; stubbed success inserts at the caret with a space; hold Ctrl+Space fills the FOCUSED box, one request despite autorepeat, Ctrl-up first keeps recording, Space-up stops; translate toggle sends `?translate=1`
- [x] docs: `docs/dictation.md` + a row in `docs/README.md`
- [x] privacy page: Dictation section pushed with Fabio's yes (Website repo 9ff2e4e)
- [x] Fabio: one real dictation in his own app (his mic, his key) - works after a full restart

## Reopened 2026-09-27: "Dictate in English" returned Portuguese (Fabio)

- [x] root cause measured: whisper-large-v3-turbo ignores `task: translate` (Portuguese Kokoro clip: turbo translate = Portuguese, large-v3 translate = English). The first translate test used English audio, so it proved nothing
- [x] `routes/deepinfra.js`: translate goes to `openai/whisper-large-v3`; test pins the URL; live through `_transcribe`: toggle off = Portuguese, toggle on = "A fox jumping in the desert at sunset with a soft golden light."
- [x] `docs/dictation.md`
- [x] `docs/releases/UNRELEASED.md` line (Fabio approved; MPI-945 released the file)
- [x] `.claude/rules/` component maps (Fabio approved): mounts for both mics, the dictation NOTE on MpiPromptBox (blocks map) and MpiAgentChat (primitives map)
- [x] Fabio: dictate in Portuguese with the toggle on, after a full restart - "translation works now"; CI green on fb40544c3

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
- [ ] privacy page: Dictation paragraph written in the Website repo, NOT pushed - needs Fabio's yes
- [ ] Fabio: one real dictation in his own app (his mic, his key) - the only path not run end to end

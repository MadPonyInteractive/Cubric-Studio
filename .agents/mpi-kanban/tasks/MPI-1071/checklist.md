# MPI-1071 checklist

- [x] Phase 1: `/deepinfra/transcribe` model allowlist (shapes checked live)
- [x] Phase 1: dictation model pref + dictation.js sends it
- [x] Phase 1: Settings "Speech to text" backend + model rows
- [x] Phase 1: tests green
- [x] Phase 2: bench Fabio's 5 clips on the 4 Remote models; Fabio picked Qwen 1.7B + Turbo
- [x] Phase 3: MpiNodes `MpiSpeechToText` node, tested on the clips, pinned
- [x] Phase 3: Qwen3-ASR-0.6B deps on R2 + plugin owner
- [x] Phase 3: `speechTranscribe` op + workflow, dictation runs on ComfyUI
- [x] Ollama backend: research + Fabio's yes, `/llm/transcribe` (Gemma 4 12B), Settings row, mic gate, tests
- [ ] Ollama backend: Fabio's mic test in the app
- [ ] ComfyUI backend: Fabio's mic test in the app
- [ ] Phase 4: Transcribe Flow planned
- [x] Docs: `docs/dictation.md`, `docs/llm.md` (Remote + Ollama; ComfyUI lines when it lands)

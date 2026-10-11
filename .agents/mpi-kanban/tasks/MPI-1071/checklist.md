# MPI-1071 checklist

- [x] Phase 1: `/deepinfra/transcribe` model allowlist (shapes checked live)
- [x] Phase 1: dictation model pref + dictation.js sends it
- [x] Phase 1: Settings "Speech to text" backend + model rows
- [x] Phase 1: tests green
- [x] Phase 2: bench Fabio's 5 clips on the 4 Remote models; Fabio picked Qwen 1.7B + Turbo
- [ ] Phase 3: MpiNodes `MpiSpeechToText` node, tested on the clips, pinned
- [ ] Phase 3: Qwen3-ASR-0.6B deps on R2 + plugin owner
- [ ] Phase 3: `speechTranscribe` op + workflow, dictation runs on ComfyUI
- [ ] Phase 4: Transcribe Flow planned
- [ ] Docs: `docs/dictation.md`, `docs/llm.md`

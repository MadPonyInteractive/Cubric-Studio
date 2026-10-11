# MPI-1071 validation

## Phase 1 - Remote model pick (2026-10-11)

- `node --test tests/deepinfra-transcribe.test.cjs` -> 9 pass, 0 fail (picked key -> its
  endpoint, unknown/inherited keys -> the default, translate forces large-v3, the Settings
  list equals the server allowlist).
- `npx eslint routes/deepinfra.js js/services/dictation.js js/components/Organisms/MpiLlmSettings/MpiLlmSettings.js` -> clean.
- Live, own `app:isolated` (port 65390): `MpiLlmSettings` mounted in a page on that server shows
  "Speech to text: Remote · DeepInfra" + "Speech model: Qwen3-ASR 1.7B" (default); picking
  Whisper Large v3 Turbo -> `Storage.getDictationModel() === 'turbo'`, the row shows it.
- Live DeepInfra calls through the shipped `_transcribe`:
  `node .agents/mpi-kanban/tasks/MPI-1071/research/stt_bench.cjs <out> <5 wavs>` on Fabio's
  "Fabio Dictation" clips (77 s total). Transcripts in `.agents/mpi-kanban/private/MPI-1071/`
  (gitignored). Qwen3-ASR-1.7B cleanest + fastest; Whisper invents words; Voxtral 500s on WebM.
  Fabio picked: Qwen default, Turbo kept, Large + Voxtral dropped.
- Vocabulary hint (`initial_prompt: "Cubric Studio"`, bench2-hint): Qwen unchanged ("Kubrick"
  in clip 5), Turbo WORSE (dropped half of clip 5). Not shipped.
- Spent: ~$0.006 of the approved $0.02.

## Phase 3 - local node, first run (2026-10-11)

- Weights `Qwen/Qwen3-ASR-0.6B-hf` -> `G:/CubricModels/speech_to_text/qwen3-asr-0.6b/` (Fabio's
  yes), model.safetensors 1564928088 bytes = HF tree size.
- `CUDA_VISIBLE_DEVICES="" <engine python> -I C:/AI/Mpi/ComfyUi-MpiNodes/check_speech.py G:/CubricModels qwen3-asr-0.6b <5 wavs>`
  -> all 5 transcribed on CPU, 2.3-12.0 s each; clip 1 "Cubic Studio", clip 5 "Kubrick's studio",
  clip 4 "detention clips".
- Same with `--context "Cubric Studio"` on clips 1 + 5 -> both "Cubric Studio". Context biasing works
  locally.

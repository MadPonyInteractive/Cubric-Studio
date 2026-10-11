# MPI-1071 - Speech to text: a Remote model pick + a local ComfyUI backend

## Decisions (Fabio, 2026-10-11)

- **Two backends in Settings > Where each job runs > "Speech to text":** Remote (DeepInfra)
  and ComfyUI (local). Same shape as the Enhancement / Description rows.
- **Remote gets a MODEL pick**, because today's default (whisper-large-v3-turbo) mishears too
  often (Fabio: "pretty dumb, fails a lot"; his bar is Wispr Flow). Candidates on DeepInfra,
  per audio minute: whisper-large-v3-turbo $0.0002, whisper-large-v3 $0.00045,
  Qwen3-ASR-1.7B $0.00045, Voxtral Small $0.003. The default is picked by a measured bench,
  not a guess.
- **"Dictate in English" is untouched.** It keeps forcing whisper-large-v3 on Remote.
  Qwen3-ASR cannot translate, so on ComfyUI the toggle notes it runs on Remote only.
- **Local = Qwen3-ASR-0.6B (`Qwen/Qwen3-ASR-0.6B-hf`, Apache-2.0, 1.56 GB)** through OUR OWN
  MpiNodes node on the engine's native `transformers` (5.13 ships `qwen3_asr`). NOT the
  1038lab pack: GPL-3.0 code, and it pulls DyNet38 / nagisa / soynlp / modelscope, a Pod image
  rebuild (MpiNodes is `installRequirements: false`, code-only).
- **Bench budget: ~$0.02** (5 clips x ~1 min x 4 Remote models), approved 2026-10-11. Fabio
  records the 5 clips in a new Cubric Studio project; the same clips bench the local node.

## Phases

### Phase 1 - Remote model pick
- `routes/deepinfra.js`: `/deepinfra/transcribe` takes `?model=<key>` from a SERVER allowlist
  (the renderer still never names an endpoint). Voxtral / Qwen3-ASR request + reply shapes
  checked live first; they may not be the Whisper `{audio, task}` shape.
- `js/core/storage.js` + `storageKeys.js`: dictation model pref.
- `js/services/dictation.js`: sends the pref.
- `MpiLlmSettings.js`: "Speech to text" backend row + "Speech model" row.
- Tests: extend `tests/deepinfra-transcribe.test.cjs`.

### Phase 2 - Bench (needs Fabio's 5 clips)
- Script in `research/`: each clip x each Remote model, transcripts side by side for Fabio.
  Pick the default from his read. Local node joins when Phase 3 lands.

### Phase 3 - Local node + op
- MpiNodes: `Mpi Speech To Text` node (AUDIO in, STRING out, language hint optional).
  Follow the sibling's `new-node.md`; commit -> push -> pin in `dev_configs/node_lock.json`.
- Weights: per-file deps under `text_encoders/qwen3-asr-0.6b/` (the gemma-3-12b-bnb
  precedent in `assetDeps.js`), mirrored to R2, owned by a PLUGIN (`pluginsRegistry.js`) so
  the uninstall GC protects them and the user installs on pick.
- Op `speechTranscribe` (`outputKind: 'text'`, like `imageDescribe`), workflow
  `comfy_workflows/speech_to_text.json`, registered in the 4 op files.
- Dictation on `comfy`: the recording reaches the graph as a file (route TBD: how an audio
  media item gets to ComfyUI's input), `onText` resolves the insert.

### Phase 4 - Transcribe Flow (separate plan when Phase 3 is green)

## Verification

**Verify mode:** user-ux

- Unit tests for the route allowlist and the pref.
- Live: dictate on each Remote model and on ComfyUI in an `app:isolated` instance.
- Fabio reads the bench transcripts and picks the default.

## Shared-file note

`js/data/modelConstants/universal_workflows.js`, `js/core/operationRegistry.js`,
`operation_registry.json` and `dev_configs/node_lock.json` carry PEER uncommitted edits
(2026-10-11). Commit through the HEAD-plus-mine blob recipe, never a whole-file add.

## Current State

2026-10-11: Phase 1 code in (route allowlist `STT_MODELS`, `Storage.get/setDictationModel`,
"Speech model" row in MpiLlmSettings, 9/9 `tests/deepinfra-transcribe.test.cjs`). Not yet seen
in a running app. Bench 1 ran on Fabio's 5 clips (project "Fabio Dictation"); transcripts in
`.agents/mpi-kanban/private/MPI-1071/` (gitignored: his own words). Findings:
- **Qwen3-ASR-1.7B best**: cleanest text, real punctuation, 0.5-2 s, no hallucinated filler.
- Whisper turbo/large hallucinate ("Thank you.", "Yeah.") and leave double spaces; large-v3
  took 8-24 s and timed out once at 60 s.
- **Voxtral 500s on WebM** (`{"detail":"inference error"}`), works on WAV; no better than Qwen
  at 6.7x the price.
- `inference_status.cost` on Voxtral read 0.05475 for 10.95 s = the catalogue rate in CENTS.
  The MPI-946 "~70x too high" Whisper reading was probably cents read as dollars too.
Fabio picked (2026-10-11): Qwen 1.7B default + Turbo; Large + Voxtral dropped; hint tested and
NOT shipped (no effect on Qwen, harmful on Turbo). Phase 1 verified (validation.md).
Phase 3 in progress. Uncommitted in the SIBLING repo `C:/AI/Mpi/ComfyUi-MpiNodes`:
`speech.py` (`MpiSpeechToText`: AUDIO + a model folder under models/speech_to_text/ + optional
`context` = the system text) and `check_speech.py` (runs the node with ComfyUI stubbed).
NOT yet in `__init__.py` / README / changelog (the sibling's `.claude/commands/new-node.md`).
Weights downloaded with Fabio's yes: `G:/CubricModels/speech_to_text/qwen3-asr-0.6b/` (7 files of
`Qwen/Qwen3-ASR-0.6B-hf`, sizes match HF). Run on CPU (GPU was leased by a peer):
`CUDA_VISIBLE_DEVICES="" engine/ComfyUI_windows_portable/python_embeded/python.exe -I C:/AI/Mpi/ComfyUi-MpiNodes/check_speech.py G:/CubricModels qwen3-asr-0.6b <wavs> [--context "Cubric Studio"]`
- 2-12 s per clip on CPU; text close to Remote Qwen 1.7B; one slip ("detention" for "dictation").
- **`--context "Cubric Studio"` FIXED the spelling** in clips 1 and 5 (both "Cubric Studio"),
  where DeepInfra's `initial_prompt` did nothing. A user DICTIONARY is therefore real on the
  local backend: the context box is the Wispr-style dictionary Fabio asked about.
- GPU speed not measured yet (lease busy).

2026-10-11 (session 8bb8a4b6): node REGISTERED in MpiNodes (`__init__.py`, README Video table,
changelog under V1.2.18), local commit `df6d3d3` on top of `fe1fb6d`, both UNPUSHED (main ahead 2).
GPU run: CUDA, sharing the card with a peer's Gemma 12B recipe test: 3-5 s a clip warm, 13 s the
first (load + warm-up); context "Cubric Studio" spelled right in clips 1 and 5. A clean-GPU timing
is still unmeasured, not a blocker.
**Fabio said yes (2026-10-11) to Ollama as an opt-in THIRD backend** (gemma4:12b), ComfyUI stays
the lighter default.

**Ollama backend BUILT 2026-10-11 (uncommitted):** `POST /llm/transcribe` in `routes/llm.js`
(`transcribeChat` + `_toWav`, ffmpeg pipes), `Storage.get/setDictationBackend`, `setDictationBackend`
in `dictation.js` (re-marks mics; Ollama needs no key), Settings "Speech to text" = dropdown
Remote | Ollama, Ollama hides the model row and mounts `MpiOllamaSetup` for `gemma4:12b`. Tests
`tests/llm-transcribe.test.cjs`; docs `dictation.md` + `llm.md`. Verified end to end in an isolated
app (validation.md). Fabio's mic test 1 on Ollama: "pretty decent". His follow-ups, BUILT + checked
in an isolated app: status bar "Transcribing" (dictation.js, both backends); Gemma stays WARM
between takes and `comfyController.runWorkflow` POSTs `/llm/ollama/unload` before a LOCAL `/prompt`
(his call: no reload per take). Still to do: his re-test of those two (app RESTART: server route
changed), his test of Remote Qwen + Turbo, and the **ComfyUI option in the Speech to text dropdown,
which he asked for** (= item 3; blocked on his yes to push MpiNodes + upload weights to R2).
The `words` query is wired server-side but nothing sends it yet: that is item 5's dictionary box
(his test misheard "Fabio Goncalves" and "Cubric").

Next, in order:
1. ~~Register the node~~ DONE (above).
2. **Ollama as a third Speech to text backend: RESEARCHED 2026-10-11, Fabio said yes (opt-in).** Bench on his 5 clips, Ollama 0.35.1, output in
   `.agents/mpi-kanban/private/MPI-1071/bench3-ollama/` (gitignored):
   - Only **Gemma 4** carries Ollama's `audio` capability (`/api/tags` `capabilities`); the docs
     never mention it. Shape that works: 16 kHz mono WAV, base64, in the message's **`images`**
     on `/api/chat`, `think: false`, temperature 0. `/v1/chat/completions` `input_audio` also
     works but drops capitals/punctuation on some clips. WebM must be converted first (server has
     `services/ffmpegBinary`). Fits `OllamaEngine.chat` in `services/llmEngines.mjs` as-is.
   - **gemma4:12b**: 1.6-2.3 s per clip warm, 8.5 GB VRAM loaded. Plain prompt: "Qubic"/"Q-Ring"
     for Cubric, one garbled phrase. **With "Words the speaker may use: Cubric Studio." in the
     prompt, all three bad clips came out right** - beat Remote Qwen 1.7B on clip 5. The dictionary
     works here too.
   - **gemma4:e4b: broken** on this box: 8/10 HTTP 500 after the audio decodes, 2/10 hung 5 min
     (matches ollama#15333). Not shippable as a default.
3. Engine side: `speech_to_text` folder type in the app's model-path config (the node adds it to
   `folder_paths` from `models_dir`, but the app's models root is `G:/CubricModels` via
   extra_model_paths: check `docs/models-path.md`), deps per file mirrored to R2 (ask Fabio:
   upload), plugin owner, `speechTranscribe` op + workflow, dictation's comfy branch (how the
   recording reaches the graph as a file).
4. Commit + push MpiNodes (ask Fabio), pin in `dev_configs/node_lock.json` (peer-dirty file: blob
   recipe).
5. Dictionary UI: a "Words to expect" box feeding `context` (local; Remote ignores it).

## Noticed

- Wispr Flow's edge is mostly an LLM tidy pass after recognition (fillers, misheard words from
  context, punctuation). A later optional "tidy" through the enhancement model. Out of scope.

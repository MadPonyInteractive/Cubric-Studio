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
- Registered in MpiNodes (`df6d3d3`, local only). GPU run with `--context "Cubric Studio"`: CUDA,
  shared with a peer's Gemma 12B run, 3-5 s a clip warm, 13 s the first; clips 1 + 5 "Cubric Studio".

## Ollama backend (2026-10-11, Fabio's yes)

- Research bench (`bench3-ollama/`, private): gemma4:12b both routes OK ~2 s, 8.5 GB loaded; e4b
  8/10 HTTP 500 + 2/10 5-min hangs. With "Words the speaker may use: Cubric Studio." 12b got
  clips 1, 3, 5 right.
- `node --test tests/llm-transcribe.test.cjs` -> 5 pass (request body, words, translate, real
  ffmpeg WebM -> 16 kHz mono WAV, unreadable bytes reject). With `deepinfra-transcribe` + storage
  + windows-hide suites: 66 pass, 0 fail. `npx eslint` on the 4 changed JS files -> clean.
- `routes/llm.js` mounted alone in express, real WebM clip 5 -> `{ok:true, text:"...Cubric Studio...",
  backend:"ollama", model:"gemma4:12b"}`; empty body and garbage bytes -> clean `ok:false`.
  Ollama answers 404 for a model it lacks (checked) -> `NO_MODEL`.
- Own `app:isolated` (port 58942, own profile, no DeepInfra key), `MpiLlmSettings` mounted in the
  page: Remote default (note + Speech model row shown); pick Ollama -> model row hidden, Download
  row "Ollama is running, and gemma4:12b is downloaded and ready.", `mpi_dictation_backend`
  stored; Remote/Ollama toggled 3x -> one Download row, none on Remote. Mic via
  `attachDictation`: Remote with no key -> disabled + "needs a DeepInfra key"; Ollama -> enabled.
  `POST :58942/llm/transcribe?words=Cubric%20Studio` with clip 1 -> correct text, "Cubric Studio".
- NOT checked by me: speaking into a real mic in the app (needs Fabio: `user-ux`).
- Fabio's mic test 1 (2026-10-11, Ollama): "pretty decent", fast. Asked for (a) a status bar
  wait bar, (b) Ollama NOT to reload per take but to clear when a generation starts, (c) a ComfyUI
  option (= Phase 3). Names misheard without a word list ("Fabian Gordon-Calves", "Cuberix").
- (a)+(b) built. Own `app:isolated` (port 50067): `runWorkflow` with fetch stubbed (the `/prompt`
  never left the page) -> POST order `/llm/ollama/unload`, `/prompt`. Fake mic (oscillator) + a 3 s
  stubbed `/llm/transcribe` -> bar "TRANSCRIBING" + pulse, mic `busy`; after -> "IDLE · Local", text
  inserted. `node --test` comfyController suites 328/328, llm-transcribe 5/5; eslint clean.
- Fabio's mic test 2 (Remote, Qwen default): "pretty good". "Cubric Studio" -> "Kubrick Studio"
  (expected: Remote takes no word list). Turbo not tested yet.
- ComfyUI backend (2026-10-11, session a9ace7ca): MpiNodes released as 1.2.18 by the release
  procedure (commit 665aed3, Actions publish green, changelog PUT HTTP 200, registry Pending) and
  pinned in node_lock.json. R2: 7 files, Content-Length byte-exact. Workflow converted + validated
  against a private CPU ComfyUI; ran there on clip1.webm -> right text, 6.6 s. LIVE in a real
  Electron window (Playwright _electron, own port/profile, attached to the 48188 engine on 665aed3,
  under the GPU lease): dictation.transcribeComfy(clip1 as audio/webm;codecs=opus) -> ok, correct
  sentence, 6.4 s first take, 0.3 s repeat (ComfyUI cache). "Cubic Studio" with the context empty.
  Full unit suite 3117 pass after updating text-op-completion's guard; eslint clean.
- NOT checked by me: the Settings ComfyUI row + Install button, and a real mic take (user-ux).
- Fabio's ComfyUI mic test (2026-10-11): works, "really impressive", barely moves the GPU.
- His corrections, done: (1) the row is in the REMOTE panel, not Settings: docs/llm.md heading +
  warning, docs/dictation.md, three user-facing strings (dictation.js x2, routes/llm.js). (2) Ollama
  model pick: GET /llm/transcribe/models (audio capability) + &model= checked by the route. Own
  app:isolated (57971): list = gemma4:12b, the abliterated 12b, e4b, gemma4-e4b-128k; model=gemma4:26b
  -> NO_MODEL "cannot hear"; the abliterated 12b under the lease -> right text, "Cubric Studio".
  Remote panel in a page: Ollama row shows, Remote model row hidden, MpiOllamaSetup ready line.
  llm-transcribe 6/6. Full suite 3116/3122: 4 Flow tests red on PEER-dirty files (flowService.js,
  MpiBaseFlow.js = MPI-1083; flowsRegistry.js = MPI-1041), green an hour earlier, none mine.
- Fabio picked gemma4:e4b: HTTP 500 "token repeat limit reached" (the bench's e4b failure again). Added: "(recommended)" on gemma4:12b, listed first (Description row style); a non-default model's failure now says to try the recommended one. Label/sort checked in node; eslint clean; llm-transcribe 6/6.

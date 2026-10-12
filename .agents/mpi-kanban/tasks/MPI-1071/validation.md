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
- 2026-10-11 (9d0faf14) Ollama rows with nothing installed: the Ollama-connection rows (Enhancement/Description/Agent) greyed out when Ollama was down; now list recommended rows installed:false (offline fallback). llm-connection +2 tests green (unreachable -> recommended rows, probe still ENDPOINT_ERROR; HTTP 500 stays an error). Down path not seen live (Fabio's Ollama running): his eye-test.
- Item 5 Words to expect: Electron window (own port/profile) -> box shown on Ollama, change saves to Storage. Real ComfyUI take of clip1 under the GPU lease: no words = "Cubic Studio" x2; words "Cubric Studio" = "Cubric Studio" x2, rest identical. eslint clean.
- Fabio's eye-test 2026-10-11 (his app, after ollama rm huihui_ai/qwen3-vl-abliterated:4b): Description row on the Ollama connection showed "not in your Ollama yet, about 3.3GB" + DOWNLOAD; pressing it showed live progress (254MB, 660MB of 3.3GB). Speech model list = the installed models that hear, recommended first.
- Speech model meta (Fabio 2026-10-11, "yes change it"): was Ollama's parameter_size alone ("11.9B"), now "12B parameters, 7.6GB" (route returns params + bytes). Checked against his live /api/tags: gemma4:12b and the abliterated 12b -> "12B parameters, 7.6GB", e4b -> "8B parameters, 9.6GB". eslint clean, llm-transcribe 6/6.
- 4a (MpiNodes speech.py, uncommitted) 2026-10-11: check_speech.py --selftest green (one piece under 20 s, longest-pause cut, all-quiet = nothing, no-pause hard cuts, click ignored, SRT exact incl. cue start after a pause). Fabio's 5 clips on CPU: text matches the one-pass node (8 s pieces had broken "and. Images." / "remembers you": dropped). 4-min file (5 clips x3 + 1 s gaps, 246.8 s): transcribed whole, 36 cues, last cue ends 4:04.38; piece starts within 0.03 s of each clip's speech after the 0.12 s click fix (was 1.2 s early on clip 2).
- 4b (30a76dd9) 2026-10-11: raw/flow_transcribe.json -> flow_transcribe.json with workflow-to-api.mjs + validate-injection-rules.mjs against a private CPU ComfyUI on :8199 (G:/ComfyUi, MpiNodes symlink = 1.2.19, scratch dirs). Ran it there, context "Cubric Studio": audio clip1.webm -> 2 SRT cues, right text, 7.9 s; the same audio muxed into an mp4 in Input_Video -> identical SRT, 5.0 s; both empty -> "" (success, no vanish); both filled -> the audio. Full unit suite 3134 pass / 0 fail; eslint clean on the touched JS.
- Pod fix (30a76dd9) 2026-10-11: Fabio: MpiNodes bump never reached his Pod. app.log 19:20-19:24: drift heal raced the boot (wrapper 404) and gave up; on ready ensureUniversalNodesOnVolume installed WITHOUT force -> wrapper already_installed -> "still absent after 60s". Fix routes/remoteModels.js: a drifted pack installs with force. tests/universal-nodes-drift.test.cjs red before (force undefined), green after; full suite 3135 pass / 0 fail. Not yet seen on a real Pod: needs his app restart + connect.
- Pod fix SEEN LIVE 2026-10-11 19:44 (Fabio restarted, new Pod 4938lfjqti7vyh): "universal nodes: installed ComfyUI-MpiNodes; ComfyUI restart -> 200" 6 s after ready; Fabio: "it landed it".
- 4c (5d694360) 2026-10-12: MpiBaseFlow onText -> item {type:text, text:SRT, fileName:<source>.srt}, painted by new Compound MpiTextResult on the frame (read-only MpiInput textarea, Copy, Download .srt via Blob + a[download] = Electron Save As). js/utils/srt.js srtToText + tests/srt.test.cjs 3/3. Full unit suite 3140 pass / 0 fail (flow-cue-stacks caught a _hasPending=false in the run body: dropped, a text run never sets it). eslint clean. Own app:isolated (49193, own profile) + playwright page: seeded s_flowResults.transcribe with a 2-cue SRT, opened the Flow -> box shows the joined text, readonly, frame--text, Copy + Download .srt, empty copy + gallery note hidden; Download spy: name "my clip.srt", type application/x-subrip, blob = the SRT verbatim. NOT seen: a real onText run (shared engine; page cannot dispatch), the Save As window itself, Copy to the clipboard.
- 4c VERIFIED by Fabio 2026-10-12 (his app): "1". Floating result window for a text result: NOT wanted ("we would not be able to read what is there anyway") - the dock showing nothing is the decision, not a gap.
- 4d (5d694360) 2026-10-12: route POST /project-media/:id/transcript writes <project>/Transcripts/<name>.srt (basename only, no project.json write); agentDispatch flowTextOutput: SRT -> {text, srtPath}, plain text passes through, a failed write keeps the text; MCP stageMedia keeps `name` on a staged copy so the .srt is never named by hash; agentLoop note for a text result ("[Finished, no card. The text: ... Subtitles file: ...]", was "card undefined"); MpiAgentChat draws no tile for a text result (was an <img> erroring into "Did not finish"); MCP generate description names output.text + output.srtPath. Tests: transcript-route 4/4 (route + flowTextOutput incl. hash-name case), srt 4/4, agent-loop TRANSCRIPT note, mcp 30 (one expectation gains name). Full suite 3143 pass / 0 fail; eslint clean. LIVE: own app:isolated + MCP generate flowId transcribe, video1 = clip2.webm, Words "Cubric Studio", under the GPU lease -> {text: right words, srtPath: <stt2>/Transcripts/clip2.srt}; the .srt reads as 2 timed cues; project.json itemGroups 0 (no card). NOT seen live: Cosmo in-app (needs an LLM key spend) and the chat tile guard. Noticed: a .webm voice recording is refused in audio1 ("that is video"); the agent must send it as video1.

## 2026-10-12 - 4e (session 2458ed19)

- Fabio: tile + hero fine, seen live on a real video run.
- Copy: dead before (main.js refused clipboard-sanitized-write since 2.0.0); fixed, tests/desktop/clipboard-copy.spec.js red without / green with; Fabio re-tested after a restart: works.
- npm test 3170 pass 0 fail; flow-library-filters + clipboard-copy desktop specs pass. Committed e3a8f8fcb, pushed.
- OPEN: native access violation in MpiSpeechToText on a cold engine (peer message 9f16b75b, 07:57:41Z); the next cold run at 08:10 worked, so intermittent.
- OPEN: Pod start.sh lacks speech_to_text in extra_model_paths.yaml (release:check red, MPI-623 message).
- OPEN 2 DONE (2026-10-12, session 1224ed33): speech_to_text line in mpi-ci start.sh, publish-runtime.sh dev, Fabio re-bootstrapped the Pod and a Transcribe on Remote returned text; promoted (stable start_sha256 23fddf62), mpi-ci 82eb9b4 pushed. release:check Pod-yaml guard passes.
- OPEN 1 repro (2026-10-12, session 1224ed33, GPU leased): private ComfyUI from the shipped engine (:8299, same LOW_VRAM + cudaMallocAsync + aimdo 0.5.5), transcribe as the FIRST job of each cold start: 12 runs quiet GPU, 18 runs with 0-145 MB VRAM free, 16 runs of the Transcribe Flow graph on a 77 s mp4 / wav. 46/46 clean, right text. Crash NOT reproduced; no code change.
- Transcribe one input at a time (2026-10-12, session 1224ed33, Fabio's ask): `inputSchema.pickOne` (flowsRegistry typedef + transcribe) greys out the other group's empty slot in MpiBaseFlow._buildSlot, hint 'Remove the other one first', no listeners. tests/desktop/flow-pick-one.spec.js passes, FAILS with the flag off (Expected length 1, Received 0); flow-clear-slot-advances still passes; 254/254 tests/flow-*.test.cjs; eslint clean. Awaiting Fabio's look.
- Fabio checked one-input-at-a-time in the app (2026-10-12): OK.

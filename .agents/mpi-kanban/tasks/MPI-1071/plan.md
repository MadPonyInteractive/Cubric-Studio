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

### Phase 4 - Transcribe Flow (planned 2026-10-11, Fabio's shape)

**Shape (Fabio):** drop an audio OR video card; the Flow shows the transcript in a text box with a
Copy button and a "Download .srt" button. NO gallery card. MCP agents get the text AND the .srt.
Same "Words to expect" box as dictation. ComfyUI only (Qwen3-ASR 0.6B, the `speech-to-text` plugin).

**Facts found (research 2026-10-11):** `MpiSpeechToText` returns one STRING, no timestamps, one
`generate(max_new_tokens=1024)` over the whole clip, so a long file is TRUNCATED. The engine's
transformers has `qwen3_asr` but NO forced aligner; nothing in either repo writes SRT. The only aligner
node found (1038lab) is GPL-3.0: not used. `MpiLoadAudioUpload` already decodes a VIDEO's audio track.
A Flow submit from an agent already reports `output: { text }` (`js/shell/agentDispatch.js:1100`).

**4a. MpiNodes: timestamps by silence, in our own node (sibling repo, release procedure).**
`MpiSpeechToText` gains a second output `srt`. Split the waveform at silences (energy, >= 300 ms),
merge into segments of at most ~8 s, hard-cut only past ~15 s with no pause, transcribe each segment
with the same `context`; `text` = the segments joined. That also lifts the 1024-token ceiling for long
files. A long subtitle line splits in two, time shared by characters. ponytail: silence split, no word
alignment; add an aligner only if Fabio's subtitles drift. Check with `check_speech.py` on his clips
+ a 5-minute file. Output 0 unchanged, so dictation's graph is untouched. Release, then pin (ask Fabio
before the push: it is public).

**4b. Op + graph.** `flowTranscribe` in the 4 op files, `outputKind: 'text'`, `requiredDeps` = the
7 `qwen3-asr-06b-*` ids. `raw/flow_transcribe.json`: `Input_Audio` and `Input_Video` (BOTH
`MpiLoadAudioUpload`, the injector routes by node class), picked lazily on `loaded` (MpiIfElse, the
DramaBox pattern), `Input_Context` -> `MpiSpeechToText` -> `srt` -> `Output_prompt`. Two optional
slots, so an app-side "drop an audio or a video" refusal (mind `tests/flow-required-media.test.cjs`).
Convert + validate ONE raw file (workflow-to-api.mjs + validate-injection-rules.mjs), never
sync-raw-workflows.mjs. Descriptor in the Flow registry, `mediaType: 'audio'`.

**4c. Flow UI.** `MpiBaseFlow._runCallbacks` gets an `onText` branch (today a text op never settles
there). A result field type: a new Primitive (read-only `MpiInput` textarea + Copy + "Download .srt"),
shown in place of the media frame and the "Saved to your gallery" note. The text = the SRT with indices
and times stripped (parsed in the renderer; the graph sends only SRT). MpiBaseFlow is shared: check
peer claims before the first edit.

**4d. The .srt file + MCP.** A server route writes `<project>/Transcripts/<source>.srt` (no card, no
project.json write) and returns the path. The Download button opens a Save As window (Fabio 2026-10-11); agents get the project copy; `_submitFlow`'s `onText` reports
`output: { text, srtPath }` for this Flow. Update the MCP instructions + `generate` description and the
in-app chat tile for a text result (add-flow 07 § "A new media KIND").

**4e. Close-out.** Tile + hero (`/mpi-flow-graphics`), `docs/agent/flows.md`, `UNRELEASED.md`, tests:
an SRT parse/strip unit test, the route, `inject-params-titles`, the required-media refusal.

**Verify:** a real run on Fabio's clips and one video card in an isolated app under the GPU lease;
an agent run through MCP returns text + a readable .srt; Fabio's eye-test of the result box.

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

2026-10-11 (session a9ace7ca): **ComfyUI option BUILT (uncommitted), not yet seen in a running app.**
Fabio said yes to the R2 upload and to releasing MpiNodes "with the release method, not just a push".
- R2: 7 files at `vision/models/speech_to_text/qwen3-asr-0.6b/`, Content-Length byte-exact on all.
- Deps `qwen3-asr-06b-*` (assetDeps.js, HF `mirrorUrl` each, lfs sha256 matched), plugin
  `speech-to-text` (pluginsRegistry.js), op `speechTranscribe` in the 4 op files (`appVersionIntroduced
  2.0.1` like every unreleased op), workflow `raw/speech_to_text.json` -> `speech_to_text.json`
  (MpiLoadAudioUpload `Input_Audio` -> MpiSpeechToText <- `Input_Context` -> PreviewAny `Output_prompt`).
  Converted + validated against a PRIVATE CPU ComfyUI on :8199 (G:/ComfyUi install, scratch dirs,
  `--extra-model-paths-config` for speech_to_text); NOT via sync-raw-workflows.mjs, which commits
  every git-changed raw file (peers' too). Ran it there on clip1.webm: right text, 6.6 s CPU.
- dictation.js: comfy branch enqueues `speechTranscribe` with the take as a `data:` URL (codecs
  stripped: the staging route's regex wants `data:<mime>;base64,`); greyed until the plugin is
  installed. Settings: third option "ComfyUI (local)", disabled with no engine, Install button for the
  plugin, model row hidden. "Dictate in English" does not apply on ComfyUI (note says so).
- Tests: full suite 3117, 1 failure = text-op-completion's deliberate guard, updated to 3 text ops.
- **MpiNodes 1.2.18 RELEASED** by the release procedure (665aed3, carries the never-released 1.2.17
  notes too; `.comfyignore` + check_speech/check_audio_range/test_switches). Registry 1.2.14-1.2.16
  are flagged `policy-v0.5: arbitrary-file-launch`, latest_version stuck on 1.2.6. **Fabio's call
  (2026-10-11): a flag never holds a release, no more issues/manual-review requests, MpiNodes is for
  Cubric Studio, stays on the registry only for his released workflows.** Saved in MpiNodes
  `.claude/rules/publishing.md` § Policy, `commands/release.md` step 0, `CLAUDE.md` (all gitignored there).
- Pinned `dev_configs/node_lock.json` -> 665aed3 (uncommitted). LIVE-verified `transcribeComfy` in an
  Electron window (validation.md). Fabio's own engine (pid under his :3000 app) already runs 665aed3.
- Fabio tested ComfyUI: works, barely touches the GPU. Then (his asks, done): the speech row is in
  the REMOTE panel (docs + strings said Settings: docs/llm.md now warns), and the Ollama backend takes
  any installed model that hears (Gemma 4 26B/31B cannot: "Text, Image" on Ollama's page).
- Fabio OK'd the Ollama Speech model list (2026-10-11): "(recommended) gemma4:12b" first, keep e4b and
  the rest listed. **His OPEN QUESTION for the next session (answer first):** when an Ollama user has
  NOTHING installed, can he pick a recommended model to install, like the other rows? "The user using
  Ollama never knows what he should install." Today the speech list adds gemma4:12b as "Not downloaded"
  and MpiOllamaSetup offers its download; check the Enhancement / Description Ollama rows do the same
  (MPI-993 `_renderInstall`) and say plainly which do and which do not.
- (old) Next: Fabio tests ComfyUI in Settings + a mic take (restart the app: server routes changed last
  session), then commit (handoff/end-session), then item 5 (dictionary).

2026-10-11 (session 9d0faf14): **Fabio's open question ANSWERED + fixed (uncommitted).**
- Speech > Ollama and Enhancement > "Ollama (local)": already offered the recommended model to
  install with nothing installed, Ollama running or not (MpiOllamaSetup starts/installs it).
- Enhancement / Description / Agent on the **Ollama connection**: did NOT. Ollama down or not
  installed = `/models` fetch fails, dropdown greyed "Connect first", `ENDPOINT_ERROR: fetch failed`,
  no install. FIX: `_connectionModels` falls back to `listRemoteModels({ offline: true })` = the
  recommended rows only, `installed: false`, on a NETWORK failure (HTTP error + probe stay errors);
  `_renderInstall` re-reads the list once Ollama is seen starting. 2 tests in llm-connection (green).
  Speech row re-paints the same way; `_pullable` now carries gemma4:12b on its own (it was pullable
  only because the agent table scores it). Down path NOT seen live: Ollama's URL is hard-coded and
  Fabio's Ollama is running; his eye-test (quit Ollama from the tray, open Remote).
- **Item 5 BUILT:** "Words to expect" box (`Storage.get/setDictationWords`, hidden on Remote) ->
  `&words=` on Ollama, `Input_Context.value` on ComfyUI. Seen in an Electron window: shows on Ollama,
  saves. Real ComfyUI take of clip1 under the lease: no words "Cubic Studio", with words "Cubric Studio".
- Next: Fabio's eye-test (Ollama quit, Remote panel; Words box).
- **Transcribe Flow shape (Fabio 2026-10-11):** NO text card. The Flow shows a text field with the
  result + a Copy button, and a Download button for the .srt. MCP agents must get BOTH the text and
  the SRT (plan: text in the result, the .srt written to a file whose path the result returns).
- Speech model meta now "12B parameters, 7.6GB" (his yes). Phase 4 plan WRITTEN (above).
- **4a BUILT (uncommitted in ComfyUi-MpiNodes: speech.py, check_speech.py, README, changelog V1.2.19).**
  DRIFT from the plan: 8 s pieces cut at every pause BROKE sentences on Fabio's clips ("audio, and.
  Images.", "remembers you. Give us" for "remembers to give us"). Now: <= 20 s = ONE pass (as before);
  longer = cut at the LONGEST pause per 20 s window (hard cut at 20 s only with no pause by 30 s); cues
  split at 84 chars with time shared over the TALK spans (pauses skipped). `check_speech.py --selftest`
  (no model) green; the 5 clips read like the one-pass text again. Engine copy of MpiNodes is a real
  folder, so nothing is live until release + pin. 4-min file: whole, 36 cues, starts within 0.03 s (click fix: BLIP_S). **RELEASED 1.2.19** by the release procedure (Fabio's yes): MpiNodes 945484f pushed, publish workflow green, changelog PUT 200, registry Pending. PINNED in dev_configs/node_lock.json (node_lock tests 35/35). Fabio's own engine still runs 665aed3 until his engine re-syncs the pin. Next: 4b (op + graph `raw/flow_transcribe.json`, wire the `srt` output to `Output_prompt`).
- Fabio's Ollama store is `H:/OllamaModels` (H: 4.7 GB free of 118 GB), not ~/.ollama.

2026-10-11 (session 30a76dd9): **4b BUILT (uncommitted), graph proven on a private CPU ComfyUI.**
- Op `flowTranscribe` in the 4 op files (`outputKind: 'text'`, slots `audio1` Input_Audio AUDIO + `video1` Input_Video VIDEO, both `required: false`). FlowDef `transcribe` in flowsRegistry.js after Stems: `requiredModels: []`, `requiredPlugins: ['speech-to-text']`, `mediaType: 'audio'`, field `Input_Context` "Words to expect". **Gated `APP_CONFIG.dev_mode`** (the Library has no dev gate any more, and a run has nowhere to land until 4c): lift it in 4e.
- Graph: two MpiLoadAudioUpload (both `block_if_empty: false`), MpiIfElse on Input_Audio `loaded`, MpiSpeechToText `srt` (slot 1) -> PreviewAny Output_prompt. DRIFT: the plan said video blocks; it does not, so an empty agent run returns "" instead of vanishing (flow-required-media law), and the frame's existing empty-run guard ("needs at least one input") is the UI refusal: no new code for it.
- Also: `services/userFlows.js` OP_KEYS allows `outputKind` (value "text" only), because `tests/user-flows.test.cjs` validates every built-in as a package; that test now stands a preview name in for a Flow with no art yet. Agent test pins `transcribe` as a RUN Flow. text-op-completion lists 4 text ops.
- Results: validation.md. Next: 4c (MpiBaseFlow onText + result Primitive). `flowService.js` / `generationService.js` are claimed by a peer (MPI-1092, 82476838): check before touching them.
- **Pod fix (same session):** a bumped MpiNodes never reached Fabio's Pod: the connect ensure installed a DRIFTED pack without force, the wrapper said already_installed. `routes/remoteModels.js` now forces drifted packs; `tests/universal-nodes-drift.test.cjs`. SEEN LIVE 19:44 (installed + ComfyUI restart 200). Noticed: the renderer drift heal re-clones again 2 s later (brief.md).
- Fabio tested ComfyUI dictation on a Pod already. Next: 4c.

2026-10-12 (session 5d694360): **4c BUILT (uncommitted), live render checked; waiting on Fabio's eye-test.**
- `MpiBaseFlow._runCallbacks.onText` -> `_showResults({ type: 'text', text: <SRT>, fileName: '<source>.srt' })`; `_showResults` branches on `_isTextResult` BEFORE the withPath filter and mounts `_mountText` on the FRAME (like compare/player; media layer stays empty so pan/zoom stay inert). Teardown in `_teardownResultSurfaces`; `_syncResultEmpty` counts it; the mount probe skips a text snapshot (nothing on disk). `s_flowResults` carries it as-is, so close/reopen keeps it. The floating window shows nothing for a text result (no path): Fabio's call, keep it that way.
- DRIFT: the result box is a **Compound** `js/components/Compounds/MpiTextResult/` (composes MpiInput + MpiButton; a Primitive imports nothing). Registered in preloadStyles + types.js; not added to the component gallery.
- DRIFT: "Download .srt" needs NO route: a Blob + `<a download>`; the app has no `will-download` handler, so Electron opens Save As. 4d's route is for AGENTS only (the project copy + `srtPath`).
- `js/utils/srt.js` `srtToText` (cue numbers + times out, cues joined) + `tests/srt.test.cjs` (the 4e parse test, done early).
- flowService needed no edit: its leg/pass wrappers spread the caller's callbacks, so `onText` reaches enqueueGeneration untouched.
- **VERIFIED by Fabio 2026-10-12.** No floating window for a text result, by his call (unreadable at that size). Next: 4d.

2026-10-12 (session 5d694360): **4d BUILT + live-verified through MCP (uncommitted).** Route `POST /project-media/:projectId/transcript` (routes/projects.js); `flowTextOutput` exported from agentDispatch (isSrt -> write the .srt, return {text, srtPath}); MCP `stageMedia` adds `name` on a STAGED copy only (own-folder cards already read right); agentLoop text-result note; MpiAgentChat skips the tile. flowService untouched. Next: 4e (tile + hero, docs, UNRELEASED, lift the dev_mode gate).

2026-10-12 (session 2458ed19): **4e docs + gate lift DONE (uncommitted).** Transcribe section in docs/agent/flows.md; `outputKind` in docs/flow-packages.md op fields (the validator already took it); two UNRELEASED bullets (speech to text in the Remote panel, Transcribe Flow); dev_mode gate removed from FlowDef `transcribe`; flow-library-filters.spec pins 4 audio creators incl. Transcribe. npm test 3147 pass 0 fail; that desktop spec passes. Privacy: no new outbound service. Tile + hero BUILT: `comfy_workflows/display/flow-transcribe.webp` (27 KB) + `.mp4` (66 KB, 6.5 s, seam 0/255), all ffmpeg (JetBrains Mono TTF from MadPony-Identity, drawtext). Waveform = a Windows SAPI voice saying "Welcome to Cubric Studio." (Fabio: no audio generation needed), text = MpiSpeechToText CPU run with context (without it: "Kubrick"). Build script in the session scratchpad. Both served 200 at the right byte size from an isolated instance; hero playback not machine-checked (no CDP on app:isolated). npm test 3147 pass. Fabio OK'd the graphics (2026-10-12) on a real video run. He found Copy dead: main.js ALLOWED_PERMISSIONS (MPI-573, shipped 2.0.0) refused `clipboard-sanitized-write`, so Settings' Copy address was broken for released users too. Added to the allowlist; `tests/desktop/clipboard-copy.spec.js` red without it (same "Write permission denied"), green with; UNRELEASED Fixes line. Next: Fabio re-tests Copy after an app RESTART (main.js), then commit.

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

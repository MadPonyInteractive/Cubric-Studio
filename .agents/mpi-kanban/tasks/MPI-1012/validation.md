# MPI-1012 validation

Verify mode: user-ux. Evidence per phase lands here; Fabio's look closes it.

## P1 colours (8d543e4d6)

- `tests/media-head-colours.test.cjs`; npm test 2674/0; CI green on 8d543e4d6 (run 37045344035).

## P2 + P3 (session 3fabe4ef, 2026-10-02)

- `npm test`: 2687 tests, 2685 pass, 0 fail (2 skipped).
- New `tests/audio-models.test.cjs` (10 cases): both ModelDefs carry the Flows' exact dep ids,
  graphs + stills on disk; Flows gone, ops tombstoned in BOTH registries; `stable-audio-3`
  gated by the SAME descriptor (id + version 1); every injected key is a graph title/widget;
  English -> English arm, all others multilingual; agent runs inject defaults (not the
  graph's bake: Chatterbox bakes the multilingual arm); describe_model lists categories /
  languages / 1-190; audio never writes a shared bucket; an old Flow submit / routine step
  runs as the model; Reuse on an old Flow card opens the model with its voice and language.
- Retargeted off the dead exemplars: agent-corpus, recipe-registry, agent-duration,
  agent-flow-handover, agent-voice-library, connector-flow-dispatch, flow-derived-fields
  (fixture), flow-uninstall-guard, inject-params-titles, smoke-flows, agent-prompt-budget.
- `npm run release:check`: op parity green; red only on the known 1.6.x archival notes.
- eslint on every touched JS file: clean.
- Desktop specs touched (flow-library-filters, flow-pick-voice, agent-chat): 39/39 passed
  locally through `playwright.desktop.config.js` (own port + userData).
- CI on c0b04e095: run 37050434172, unit + desktop (1-4) all `success` (2026-10-02 19:08Z).

## P4 prompt box voice (session a8d03bbe, 2026-10-02)

- `node --test "tests/**/*.test.cjs"`: 2688 tests, 2686 pass, 0 fail (2 skipped).
- New case in `tests/audio-models.test.cjs`: `tts` unavailable with no audio staged
  (`requiresAudio` 1), available with `audioCount: 1`, and no other op of any model waits on
  audio. Bites: deleting `audioCount >= requiresAudio` from `getAvailableCommands` fails it.
- New `tests/desktop/prompt-box-voice.spec.js` (gallery box): `+` reads "Add a voice" on
  Chatterbox and opens the picker on audio with the voice-library and mic cards; tts is
  `aria-disabled` with "needs a voice" until a voice is injected; no `+` on Stable Audio 3;
  "Add a reference image" back on SDXL. Bites twice: without the weightless-runner pin the box
  never mounts; with `_voiceSlot()` returning null the label assertion fails.
- `npx playwright test --config=playwright.desktop.config.js` on prompt-box-voice +
  media-picker-to-history + media-picker-cards + gallery-stack-run + flow-pick-voice: all pass.
- eslint on every touched file: clean.
- CI on 21ee28998: run 37052857123, unit + desktop (1-4) all `success`.

## P5 voice card on a model op (session a8d03bbe, 2026-10-02)

- `node --test "tests/**/*.test.cjs"`: 2691 tests, 2689 pass, 0 fail (2 skipped).
- agent-loop "MPI-1012 — the voice card on a model op" (2 cases): card names Chatterbox and
  the voice; Use runs it with the voice id; Pick from the library calls `openPrompt` with the
  line, the language, `pickVoice: 'audio1'`, no voice, no model call. Bites: reverting the
  `(args.flowId || args.modelId)` gate fails both.
- agent-voice-library: `openPrompt` hands `s_promptOpen` (ttsLanguage 'Italian (it)'), and
  NOT_NOW / INVALID_LANGUAGE / OP_UNAVAILABLE hand nothing over.
- agent-no-delete allowlist: `POST /connector/open-prompt` added (fills, runs nothing).
- prompt-box-voice spec test 2: `s_promptOpen` + navigate -> gallery box on tts, line filled,
  picker in the voice library. Bites: dropping the mount-time `_takePromptOpen()` fails it.
- Desktop agent-chat + flow-pick-voice + media-picker-to-history + prompt-box-voice: 45/45.
- eslint on every touched file: clean.
- CI on e78e16c4f: run 37054738413, unit + desktop (1-4) all `success`.
- P5 leftover, `app:operations`: renders `## Sound & Music (`t2a`)` and
  `## Text to Speech (`tts`)` with the registry info, both help paragraphs and the model
  (rendered and read 2026-10-02). Already guarded by `tests/agent-corpus.test.cjs`
  `testOperationsIsRenderedFromTheRegistries` (every offered op, its info verbatim). No change.

## P6 smoke runner (session 7ca011ff, 2026-10-02)

- `node --test "tests/**/*.test.cjs"`: 2700 tests, 2698 pass, 0 fail (2 skipped).
- New `tests/smoke-model-ops.test.cjs` (8 cases): `prepOp` chatterbox/tts SKIPs with no
  audio fixture and puts `smoke-probe.wav` on `Input_Audio` with one; stable-audio-3/t2a needs
  no fixture and gets `Input_Duration=1`; every audio model op preps offline; `countMedia`
  counts `audio`; `installProbe` reads a seen-then-pruned job as finished and asks the disk
  (on disk = ok, absent = failed), never asks about a job that never registered, takes `seen`
  from the start POST, reads a failed job/dep at once, treats a disk-check throw as a blip.
  Each case fails on HEAD's runner (old SKIP for non-image slots; no `countMedia` /
  `installProbe` export; absent = false forever).
- `tests/smoke-evidence-merge.test.cjs` +1: a model the prior scope never names stays
  `unproven` (HEAD's intersection returned `[]`, claiming stable-audio-3 proven).
- `node scripts/smoke-workflows.mjs --self-check`: OK (the old installProbe asserts still hold).
- `--plan` NOT run: it reads the local engine's `/object_info` (Fabio's), and the offline half
  it would prove is what the new prepOp cases run. `dev_configs/smoke-run.txt` untouched.
- eslint on the runner + both test files: clean. Smoke tests together: 62/62.
- Committed 82b19e16d, pushed.

## P7 docs (session 7ca011ff, 2026-10-02)

- `node --test "tests/**/*.test.cjs"`: 2700 tests, 2698 pass, 0 fail (2 skipped).
- Model drawer `alsoLicensed` (Stable Audio 3's Gemma terms): `tests/audio-models.test.cjs`
  licence case now asserts the descriptor carries it AND `MpiModelManager.js` renders it;
  red on HEAD (the drawer had no `alsoLicensed` loop). eslint clean.
- Docs moved with `git mv` (history kept): `existing-flows/chatter-box.md` ->
  `docs/models/chatterbox/README.md`, `sound-and-music.md` -> `docs/models/stable-audio-3/README.md`
  (200 lines), both rewritten to the model shape; index rows in `docs/models/README.md`,
  `docs/README.md` map. Every in-repo reference re-grepped: none left outside history notes.
- Skills: `cubric-vision-generate` gains audio (description, `category`/`language`/`duration`
  rows, an Audio section with both curls + library voices); `cubric-vision-flows` drops the
  Chatterbox recipe for DramaBox-only; `cubric-vision` core routes speech to generate.
- `docs/releases/UNRELEASED.md`: Flow roster Thirteen -> Eleven, audio-models bullet.
- Bench fixture `services/agentBench/connector-models.json`: the two retired Flow rows out,
  two model rows in (built by `namedParamsFor`), byte-exact round-trip guarded;
  `tests/agent-bench.test.cjs` green.

# MPI-1012 — Audio in the prompt box

**Card:** Sound & Music (Stable Audio 3) and Text to Speech (Chatterbox) become prompt-box
MODELS and leave the Flow Library. Voice Changer STAYS a Flow. Plus (Fabio, same day): the media
section labels in all four library overlays take their family colour.
**Umbrella:** MPI-595 (a 2.0 gate). MPI-595 item 2 (paid scoped re-smoke) waits for this so one
run covers the two new models.
**Map:** `research.md` (both sweeps, file:line). Read it before any phase.

## Fabio's words (2026-10-02)

- "Sound and music. It doesn't have inputs. All it has is two parameters and a prompt. I don't
  think it should be a flow." / "yes, move both to the prompt box, keep voice changer".
- "Don't forget to account for any ramifications, like updating the in-app agent and all those
  installations, etc. You can use the same graphics to make the models instead of flows."
- Overlays: "Image should have the pink prism colour, video should have reel colour and audio
  should have vinyl colour" — Model picker, Model Library (install), Flow Library (select +
  install). Tokens (DESIGN.md § The accent family, never sampled off art): image
  `--vision-accent`, video `--video-accent`, audio `--accent-audio`.

## Decisions (agent picks, stated; Fabio may overrule at his look)

1. **Ids + names.** ModelDefs `stable-audio-3` ("Stable Audio 3") and `chatterbox` ("Chatterbox").
   Model tiles name the MODEL like every other tile; the op says what it makes.
2. **Ops** (new, `mediaType: MEDIA_TYPE.AUDIO`, NOT universal): `t2a` "Sound & Music" (no media)
   and `tts` "Text to Speech" (ONE required `audio1` slot "Voice to speak in", voice library).
   Add short codes to `OP_ORDER`. Both join `ENHANCE_EXEMPT_OPS` (Sound & Music shipped with no
   enhancer on purpose; a TTS line must never be rewritten). `filePrefix` per op.
3. **Workflows** reuse the shipped runtime graphs, renamed to model convention with `git mv`
   (runtime + `raw/`): `flow_stable_audio.json` -> `stable_audio_3.json`, `flow_chatter_box.json`
   -> `chatterbox_tts.json`. No graph edit. Regenerate the update manifest the normal way.
4. **Controls** (perModel scope, so the image/video shared bucket is never touched):
   `audioCategory` (select -> `Input_Category`, Music / Instrument / SFX / One-shot, same strings
   as the Flow), `audioLength` (slider 1..190 s, default 10 -> `Input_Duration`; NOT the video
   `duration` control: its bounds, hover and shared scope are video's), `ttsLanguage` (select ->
   `Input_Language.language` AND `Input_Is_Multilingual`, the Flow's `derived` rule folded into
   one control's `getInjectionParams`, the `ratio` W+H pattern). Agent `namedParamsFor` +
   `generationControls` learn the same three, so raw agent calls get the derivation too.
5. **Deps** = the Flows' `requiredDeps` verbatim (same ids, same `targetPath`) -> existing installs
   read installed on first sync, nothing re-downloads, on a Pod volume too.
   `capabilities: { audio: true, negativePrompt: false, batch: false }` on Chatterbox (else
   `filterMediaInputsForModel` drops the voice slot); Stable Audio `negativePrompt: false, batch: false`.
6. **Licence**: re-key `MODEL_LICENCES` `'flow:sound-and-music'` -> `'stable-audio-3'`, SAME
   `STABLE_AUDIO_3` object (same id, `version: 1`) -> no user is re-prompted. Fix the stale "no
   model card" comment. New test: the gated model id resolves a licence (the existing sweep only
   checks `flow:` keys, so a miss would be silent).
7. **One commit removes the two FlowDefs AND adds the two ModelDefs** — never a window where the
   Stable Audio weights have no owner (the orphan sweep would take 11.81 GB).
8. **Tombstones**: `flowChatterBox`, `flowSoundAndMusic` -> `deprecated: true` in BOTH op
   registries, removed from `commandRegistry` + `universal_workflows`. Never reused.
9. **Retired-Flow aliases, ONE table** (`RETIRED_FLOWS` beside the Flow registry):
   `sound-and-music` -> `{ modelId: 'stable-audio-3', op: 't2a', fields }`,
   `chatter-box` -> `{ modelId: 'chatterbox', op: 'tts', fields }`. Consumers: card Reuse (opens
   the prompt box on the right model + op and restores category/length/language/voice instead of
   injecting into whatever model is active), routine steps (validated + run as the model step, so
   saved routines keep working), agent + connector `generate` with an old flowId (routed, plus
   the error text names the model if routing is impossible).
10. **Graphics**: rename the two webps to `stable-audio-3.webp` / `chatterbox.webp` and set
    them as the ModelDefs' `image`. The two hero mp4s have no model surface -> deleted (git keeps them).
11. **Prompt box audio**: model picker + Model Library get an Audio section and an Audio media
    filter; audio tiles use the 4:5 still; badge/pill say Audio; selected-model store, last-picked
    media restore and the gallery default op learn `audio`; `+` opens the media picker on the
    slot's type with the voice library + recording (passed down as props from the Block that
    mounts the box — Organisms cannot import Blocks); op dims while its required voice is missing.
12. **Agent (Cosmo)**: audio models in `list_models` with their params and voices; voice library
    resolves on MODEL slots (`media: [{ role, voice }]`); the voice confirm card fires for a model
    with a voice slot; `app:operations` info/help for `t2a`/`tts`; agent guides
    `docs/agent/models/stable-audio-3.md` + `chatterbox.md` (moved from `docs/agent/flows.md`'s
    spoken-line section, which then points at the model); `modelPriority` audio tasks; the
    `duration` param note; speech mascot clip from models. MCP: audio runs return a jobId
    (`slow` — Stable Audio can run 190 s).
13. **Smoke**: the runner counts audio outputs for MODEL ops and feeds `smoke-probe.wav` to a
    required audio slot. Evidence for the two new models comes from MPI-595 item 2 (paid, quoted
    first): `--models stable-audio-3,chatterbox` joins `minimax-h3` + the three Flows.
14. **Colours** (Fabio): `__media-head--image|video|audio` modifiers in `MpiModelPicker.css`,
    `MpiModelManager.css`, `MpiFlowLibrary.css` -> `--vision-accent` / `--video-accent` /
    `--accent-audio`; `MpiTileSheet.css` `__flag--mediaImage|Video|Audio` and
    `__badge--image|video|audio` the same; JS emits the modifier for every media. Count stays muted.

## Phases (each ends green: `npm test`, eslint on touched files)

- [x] **P1 Colours** — the four overlays + tile flags/badges (decision 14). Desktop spec or
  computed-style unit check per header. **Verify mode: user-ux** (Fabio's look).
- [x] **P2 Audio as a model media type** — typedefs, selected-model store, gallery restore,
  `_SHARED_TYPES` guard (audio controls are perModel; assert audio never writes the image
  bucket), picker + Library sections/filter/tiles/pills, MpiTileSheet audio thumb + badge.
- [x] **P3 The swap (ONE commit)** — ops, controls, ModelDefs, workflow renames, licence re-key,
  graphics, FlowDefs out, tombstones, aliases table + Reuse + routines, tests updated
  (`flow-uninstall-guard` case rewritten: Voice Changer now owns `ComfyUI_Fill-ChatterBox` alone),
  new tests (licence key, alias routing, audio model listed). `release:check` op parity green.
- [x] **P4 Prompt box voice + required slot** — media picker on slot type + voice library +
  record; op dimming for a missing required audio slot; Enhance hidden.
- [x] **P5 Agent / connector / MCP** — decision 12; update the agent tests listed in research B.
- [x] **P6 Smoke runner** — decision 13 (`tests/smoke-*.test.cjs` cases).
- [x] **P7 Docs** — move `existing-flows/chatter-box.md` + `sound-and-music.md` to the model docs
  home, fix every cross-link (research B), `docs/README.md` map, both skills,
  `UNRELEASED.md` (roster Thirteen -> Eleven + an audio-models bullet; Flow-list reconcile),
  bench fixture. OUTSIDE the repo (never written from here): message the Docs-site session
  (`pages/flows.html`, `audio.html`, `home.html` "Thirteen", `llms.txt`, `seo-routes.mjs`) and
  tell Fabio about the Website lines (`index.html:247-275`).
- [x] **P8 Verify live** — `npm run app:isolated` (own port + profile, never :3000): pick each
  audio model, generate one Stable Audio clip and one Chatterbox line on the local engine, Reuse
  an OLD Flow card, run a routine step naming `chatter-box`, an agent `generate` by modelId.
  Local GPU only, no money. Downloads ~7-12 GB if the weights are absent: ask Fabio first.
  Then Fabio's look (colours + audio in the prompt box).
- [x] **P9 Chatterbox Speed + Exaggeration** (Fabio 2026-10-03, lines rushed) — perModel
  sliders `ttsSpeed` -> `cfg_weight`, `ttsExaggeration` -> `exaggeration`, both arms (node 43
  retitled `Input_TTS_English`); agent runs use the saved values. **Verify mode: user-ux**
  (Fabio listens).

## Verification

**Verify mode:** user-ux (it is a look-and-feel change Fabio judges; every phase also has its
automated checks).

## Current State

2026-10-02 (session b98e08bd): card created, both sweeps done (`research.md`), plan written.
**P1 DONE** (8d543e4d6, CI green); Fabio's look pending (the Flow Library's audio header now
sits in Vinyl green right above the green Ready chip; his call at the look).

2026-10-02 (session 3fabe4ef): **P2 + P3 DONE in code, ONE commit** (see Plan Drift for what
P5 work came forward). Unit suite green; release:check red only on the known 1.6.x archival
notes. What landed: `getLastSelectedMediaType`/`MODEL_MEDIA_TYPES` (modelHelpers) for the
three image|video coercions; picker + Model Library audio section/filter/pill; `_mediaTypeOf`
passes audio (no shared bucket by design); ops `t2a`/`tts` + 3 perModel controls
(`audioCategory` radio, `audioLength` slider 1-190, `ttsLanguage` dropdown emitting the
language AND `Input_Is_Multilingual` via `ttsLanguageParams`); option tables in
commandRegistry (`AUDIO_CATEGORIES`, `TTS_LANGUAGES`, `AUDIO_LENGTH`); ModelDefs
`stable-audio-3` + `chatterbox` (Flow dep ids verbatim + `ComfyUI-MpiNodes`); graphs renamed
`stable_audio_3.json` / `chatterbox_tts.json` (runtime + raw, plain mv, no graph edit); webps
renamed, hero mp4s deleted; FlowDefs + universal_workflows out; tombstones in both registries;
licence key `stable-audio-3` (same descriptor); `js/data/retiredFlows.js` = the ONE alias table
(Reuse via promptReuse.js, routines via validateRoutine, connector generate/quote reroute,
openFlow/buildFlow refusal names the model). New test `tests/audio-models.test.cjs`.
**Committed c0b04e095 + pushed** (58 files; CI was running at handoff). **Next: check CI on
c0b04e095, then P4** — MpiGalleryBlock `_mountPb` passes `recordAudio: recordAudioIntoProject`;
MpiPromptBox imports MpiVoicePicker; `_openMediaPicker` opens on 'audio' with
`voiceRoute: slot.voiceLibrary` when the active op's (model-filtered) slots are audio-only;
`_addBtn` title follows the op ("Add a voice"); dim the op while a REQUIRED audio slot is
empty (add `audioCount` to getAvailableCommands' ctx, min-only, and an `_opBlockedReason`
clause). Then the rest of P5 (Cosmo's voice-pick card for a MODEL slot), P6-P8.

2026-10-02 (session a8d03bbe): tree cleaned first (1baff2718: MPI-958 back on the board, 64
lost root events restored, MPI-706/730/858 stranded files; manifest + 1.4.2 token restored
from HEAD; validator clean). CI green on c0b04e095 (run 37050434172). **P4 DONE**:
`getAvailableCommands` returns `requiresAudio` (REQUIRED audio slots after the model filter)
and gates `available` on `ctx.audioCount`; `_opBlockedReason` says "needs a voice";
`_voiceSlot()` = the active op's required audio slot drives the `+` (label "Add a voice",
picker on audio + `voiceRoute` + `MpiVoicePicker` + `props.recordAudio`, which MpiGalleryBlock
hands down); `_refreshAddBtn()` runs from `_refreshOpSlot` and detaches the `+` when the model
takes nothing (Sound & Music). Pick type now follows the PICKED tile. Doc:
`docs/op-model-selection.md` § Which ops appear. **Next: rest of P5** — Cosmo's voice-pick card
for a MODEL slot: the renderer capability to open the gallery box on Chatterbox/tts with the
line filled and `MpiMediaPicker` on the voice library (`openVoiceLibrary: true`), reusing
`_openMediaPicker`; then P6-P8.

2026-10-02 later (session a8d03bbe): P4 pushed (21ee28998, CI green run 37052857123). **P5
voice card on a MODEL op DONE** (verified, committed at handoff): loop `_rememberGuides` indexes
model-op media-row voices + `_modelNames`; `_pickedVoice` covers `args.modelId`; 'library' ->
`_openPrompt` -> `agentTools.openPrompt` -> `POST /connector/open-prompt` -> renderer
`prompt.open` (`agentDispatch.openPrompt`: NOT_NOW / NO_PROJECT / UNKNOWN_MODEL /
OP_UNAVAILABLE / INVALID_LANGUAGE / VIEW_BUSY) -> `state.s_promptOpen` + navigate or
`prompt:open` -> MpiGalleryBlock `_takePromptOpen` (Reuse's `_applyPromptReuse`, then
`ttsLanguage` via applyPromptReuseSettings, then `el.openMediaPicker({ openVoiceLibrary: true })`).
**Next: P5 leftover** = check `app:operations` (services/agentCorpus.mjs builds it) covers
`t2a`/`tts` info/help; then P6 smoke runner (decision 13), P7 docs, P8 live check (ask Fabio
before using his GPU or downloading).

2026-10-02 (session 7ca011ff): CI green on e78e16c4f (run 37054738413). P5 leftover: no change,
`app:operations` already renders t2a/tts info + help from the registry (agent-corpus test
guards it). **P6 DONE** in `scripts/smoke-workflows.mjs`: `prepOp(reg, model, op, probes)`
takes the fixture map like `prepFlowOp` (a required slot of any type gets its fixture, else
SKIP naming it); `PROBE_PLACEHOLDERS` shared by both offline sweeps; `countMedia(outputs)`
shared by both legs (audio counts); every run stages the mp4 + wav (upload failure non-fatal);
plus the two fold-ins in Plan Drift. Playbook `docs/playbooks/bump-engine/01-smoke-run.md`
updated (probe media, audio counting, install verdicts, merge coverage, stale Flow counts).
**Next: P7 docs** (the existing-flows docs move, UNRELEASED roster, skills, bench fixture,
Docs-site message, Website lines to Fabio), then P8 (ask Fabio first).

2026-10-02 later (session 7ca011ff): **P6 committed 82b19e16d (pushed). P7 DONE in-repo**:
docs moved to `docs/models/chatterbox/` + `docs/models/stable-audio-3/` (git mv, rewritten to the
model shape), cross-links, three skills, UNRELEASED (Eleven + audio bullet), bench fixture. Found
+ fixed a P3 regression: the Model drawer never rendered `alsoLicensed`, so Stable Audio's Gemma
terms had no standing link once it stopped being a Flow. OUTSIDE the repo, handed to Fabio (no
Docs-site session live): Docs `pages/flows.html` (:5, :47, :148, :188), `pages/audio.html:8`,
`flows/index.html`, `audio/index.html:133`, `llms.txt:23`, `scripts/seo-routes.mjs:204`;
Website `index.html:247, 260, 262, 272, 275` ("Thirteen", TTS + Sound & Music listed as Flows).
**Next: P8** — needs Fabio's yes first (local GPU; ~7-12 GB download if the weights are absent):
`npm run app:isolated`, pick each audio model, one Stable Audio clip + one Chatterbox line, Reuse
an old Flow card, a routine step naming `chatter-box`, an agent `generate` by modelId, count
progressStages bars. Then his look (colours + audio in the prompt box), then MPI-595 item 2.

2026-10-02 (session c49812a3): CI green on eff5b6a0c (37058921023). **P8 live check DONE**
with Fabio's yes, every check green, evidence in `validation.md` § P8 (agent install + generate
by modelId, both TTS arms, old routine step + old flowId, picker/box/params, Cue from the box,
Reuse of OLD Flow cards). Chatterbox downloaded into the shared engine (6.4 GB). No code
changed. progressStages: no entry needed (Stable Audio = 1 bar; Chatterbox emits none,
pre-existing, brief.md Noticed). **Next: Fabio's look** (P1 colours in the four overlays +
audio in the prompt box) -> close MPI-1012; then MPI-595 item 2 (paid re-smoke, quote first).
Throwaway projects left in his Documents: `MPI-1012 P8 audio check`, `MPI-1012 P8 copy of TTS`,
`MPI-1012 P8 copy of Music Maker` (delete after his look).
Fabio went to bed before the look; the visible instance was closed. Tomorrow: relaunch it with
`CUBRIC_BACKGROUND=0 npm run app:isolated` (own profile, Chatterbox already installed), give
him the five look steps, and ask again whether to delete the three test projects (pick: yes).

2026-10-03 (session 5854a2e5): **Fabio's look PASSED all five** (validation.md). Same message:
Chatterbox lines rushed -> **P9 DONE in code, uncommitted**: `TTS_KNOBS` + `ttsKnobParams`
(commandRegistry), `_ttsKnob` sliders (PromptBoxControls), defaults 0.5 (promptControlDefaults),
agent path (generationControls, saved value else default, no named param), graph node 43
retitled `Input_TTS_English` (runtime + raw). Measured: cfg 0.2/0.5/0.8 -> 8.16/7.84/7.36 s, so
Speed = cfg_weight uninverted. Unit 2698/0, eslint clean. Docs: chatterbox README § Speed and
Exaggeration, agent guide, UNRELEASED. Fabio said YES to deleting the three `MPI-1012 P8 ...`
projects; held until he has heard the `speed cfg 0.2/0.5/0.8` cards in `MPI-1012 P8 audio
check`. **Next: Fabio listens + tries the sliders (isolated instance), '1' -> delete the three
projects -> mpi-end-session closes MPI-1012.**

## Plan Drift

- 2026-10-02 (P3): **part of P5 came forward**, because the suite requires it — every shipped
  model must resolve a guide (`agent-corpus`), and every connector named param must be on the
  agent tool (`agent-duration`). Landed with P3: `docs/agent/models/stable-audio-3.md` +
  `chatterbox.md`; a model with NO recipe (all ops enhance-exempt) is guided by its `type`
  (`agentCorpus.guideIdsByModel`, both corpus tests + the recipe audit updated to match);
  named params `category` / `language` / `duration` (1-190 on t2a) in resolveNamedParams,
  namedParamsFor, the connector, routines, the agent + MCP tool schemas (tool budget raised
  18,490 -> 18,673 with the reason in the test); library voices on a MODEL slot (CommandDef
  slot `voiceLibrary: 'character'`; `resolveVoices`/`slotVoices` take an op key; listed on
  the op's media row); MCP treats audio as slow; `docs/agent/flows.md` Spoken lines points at
  the model; Cosmo's speech clip keys on any voice-library op.
- **Still P5:** Cosmo's voice-pick CARD ("Pick from the voice library / Use <voice>") fires for
  Flows only. For a model it needs a renderer capability that does not exist (open the prompt
  box on the model, line filled, media picker on the voice library) — build it with P4's picker.
  Until then a library voice on `tts` runs as sent.
- `derived[]` has no FlowDef user any more (Chatterbox's was the only one). Kept as a Flow
  capability; `tests/flow-derived-fields.test.cjs` rebuilt on a fixture of the old shape.
- Not ranked in `modelPriority.js`: each audio task has one candidate ("a list of one ranks
  nothing", 03-model-registry.md). `progressStages.js`: no entry (the Flows had none); count
  the bars live at P8.
- Connector reroute leaves a body with BOTH flowId and modelId alone, so it is still refused.
- 2026-10-02 (P4): the voice `+` keys on a REQUIRED audio slot, not "audio-only slots": LTX's
  `t2v_ms` has an optional audio slot only, and keying on that would have turned its `+` (an
  image that moves t2v to i2v) into an audio picker. Added beyond the plan text: no `+` on a
  model that takes no media at all (Sound & Music), since every pick there ended in "not
  supported"; and a pick is staged as the picked tile's type, not the slot's.
- 2026-10-02 (P5): the loop/MCP/handover tests that mock a `chatter-box` FLOW row were kept as
  fixtures on purpose: they exercise the generic Flow path (open: true, install, the voice card),
  still live for Voice Changer. The model path has its own tests (agent-loop "MPI-1012 — the
  voice card on a model op", agent-voice-library openPrompt case, prompt-box-voice spec test 2).
- 2026-10-02 (P6): **two runner faults folded in**, both on the path MPI-595 item 2's paid
  re-smoke takes to prove the two new models. (1) Open message 1b701cfc (MPI-513 -> MPI-894,
  a deferred umbrella nobody would land): `/comfy/downloads/status` prunes a finished job
  (`done` <= 120 s, `failed` after 30 s), so `installProbe` waited out 3 h on a job it missed,
  and the post-loop failure scan only ever saw the last model's failure. Now the probe takes
  `seen` from the start POST's `job`, reads seen-then-absent as finished and asks
  `/comfy/models/check` (remote-aware), and the verdict rides on `probe.failed`, read per
  model. (2) `mergeEvidence` intersected `unproven` with the prior's, so a model added since
  the prior run (both audio models) read as PROVEN after any scoped merge. Not done:
  `release:check` still prints the file's frozen "covers all 36" until item 2's run rewrites
  the scope (noted in brief.md).

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

- [ ] **P1 Colours** — the four overlays + tile flags/badges (decision 14). Desktop spec or
  computed-style unit check per header. **Verify mode: user-ux** (Fabio's look).
- [ ] **P2 Audio as a model media type** — typedefs, selected-model store, gallery restore,
  `_SHARED_TYPES` guard (audio controls are perModel; assert audio never writes the image
  bucket), picker + Library sections/filter/tiles/pills, MpiTileSheet audio thumb + badge.
- [ ] **P3 The swap (ONE commit)** — ops, controls, ModelDefs, workflow renames, licence re-key,
  graphics, FlowDefs out, tombstones, aliases table + Reuse + routines, tests updated
  (`flow-uninstall-guard` case rewritten: Voice Changer now owns `ComfyUI_Fill-ChatterBox` alone),
  new tests (licence key, alias routing, audio model listed). `release:check` op parity green.
- [x] **P4 Prompt box voice + required slot** — media picker on slot type + voice library +
  record; op dimming for a missing required audio slot; Enhance hidden.
- [ ] **P5 Agent / connector / MCP** — decision 12; update the agent tests listed in research B.
- [ ] **P6 Smoke runner** — decision 13 (`tests/smoke-*.test.cjs` cases).
- [ ] **P7 Docs** — move `existing-flows/chatter-box.md` + `sound-and-music.md` to the model docs
  home, fix every cross-link (research B), `docs/README.md` map, both skills,
  `UNRELEASED.md` (roster Thirteen -> Eleven + an audio-models bullet; Flow-list reconcile),
  bench fixture. OUTSIDE the repo (never written from here): message the Docs-site session
  (`pages/flows.html`, `audio.html`, `home.html` "Thirteen", `llms.txt`, `seo-routes.mjs`) and
  tell Fabio about the Website lines (`index.html:247-275`).
- [ ] **P8 Verify live** — `npm run app:isolated` (own port + profile, never :3000): pick each
  audio model, generate one Stable Audio clip and one Chatterbox line on the local engine, Reuse
  an OLD Flow card, run a routine step naming `chatter-box`, an agent `generate` by modelId.
  Local GPU only, no money. Downloads ~7-12 GB if the weights are absent: ask Fabio first.
  Then Fabio's look (colours + audio in the prompt box).

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

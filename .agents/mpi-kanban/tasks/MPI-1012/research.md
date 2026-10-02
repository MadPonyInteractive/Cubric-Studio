# MPI-1012 research — the two maps (2026-10-02, read-only sweeps)

Two Explore sweeps, condensed. Every pointer is `file:line` at `05a50b210`; re-grep before
trusting a line number. RISK = fails silently or hard-assumes image|video.

## A. What an AUDIO-output ModelDef touches

**Shape**
- `js/data/modelConstants/models.js:2-37` typedef — RISK :11 `mediaType: 'image'|'video'`;
  :16 `capabilities` (`audio` flag gates audio slots, `negativePrompt` defaults true — both graphs
  have no `Input_Negative`, set false); :27-28 preview `image`/`video` (filenames in
  `comfy_workflows/display/`); :30-34 `supportedOps`/`workflows`/`dependencies`. Examples:
  `sdxl-realistic` :63-138, `ltx-23` :1354-1431.
- `js/data/commandRegistry.js` — :23-27 `MEDIA_TYPE.AUDIO` exists; RISK :101 CommandDef
  `mediaType` typed image|video; :138-157 `mediaInputs` slot shape (required defaults TRUE,
  :1865); :158 `components`; :88 `filePrefix`. Flow ops to copy: `flowChatterBox` :1351-1362
  (`flowTTS` prefix, required `audio1`), `flowSoundAndMusic` :1427-1439. RISK :1937-1952
  `filterMediaInputsForModel` drops audio slots unless `model.capabilities.audio === true`.
  :1722-1725 `OP_ORDER` has no audio codes. :1732-1775 `getAvailableCommands` filters
  `cmd.mediaType === mediaType && !universal` → new ops must be `MEDIA_TYPE.AUDIO`, not universal.
  :1532-1534 `ENHANCE_EXEMPT_OPS`. :1786-1802 `isTextOnlyOp`/`pickTextOnlyOp` (both new ops read
  text-only: no image/video slots).
- Controls: `js/components/Organisms/MpiPromptBox/PromptBoxControls.js:146` hand-written
  `PROMPT_BOX_CONTROLS` (`select` example `pidVariant` :935-989; slider `duration` :607-684,
  RISK scope `shared` + "Video length" hover :658 + bounds 1..30 :83). One control may emit
  several keys (`ratio` → Width+Height :261-262) — the way to do Chatterbox's `derived`
  `Input_Is_Multilingual`. Plumbing :1602-1610, :1629-1719 `visibleControlIds`, :1744, :1837 Reuse.
  RISK :45-47 `_mediaTypeOf` maps non-video → image (shared bucket). Defaults
  `js/data/promptControlDefaults.js:20`.
- Injection `js/services/commandExecutor.js:821-873` `_buildParams` (Positive/Negative/Seed always,
  `opInject`, controls last), :928-997 slot → node title. Dotted `Title.widget` keys work.
- Graph titles: `flow_chatter_box.json` `Input_Positive`#34, `Input_Language`#33,
  `Input_Is_Multilingual`#52, `Input_Audio`#54, `Output_Audio`#59, `Input_Seed`#61.
  `flow_stable_audio.json` `Input_Positive`#1, `Input_Category`#2, `Input_Duration`#3,
  `Input_Seed`#4, `Output_Audio`#20.
- Field sources `js/data/flowsRegistry.js`: chatter-box :1591-1730 (deps :1611-1644, voice slot
  :1656-1661, 23 languages :1692-1721, `derived` :1725-1728); sound-and-music :2527-2628 (deps
  :2551-2555, `Input_Category` :2585-2597, `Input_Duration` 1-190 :2612-2613).

**Consumers that assume image|video (each needs audio)**
- Prompt box `MpiPromptBox.js`: :479-512 `_emitMediaChange` counts image/video only; :826-845
  `_pickOpForModel`; RISK :1013-1030 `_openMediaPicker` hard-codes image, no voice route, "+ Add a
  reference image" :997; RISK op never dimmed for a missing voice (`_opBlockedReason` :1992-2005
  has no audio case; only the Cue toast catches it); RISK :2421-2446 Enhance offered unless
  exempt; :2135 accent already handles audio.
- RISK `js/data/projectModel.js:534` `_SHARED_TYPES {image, video}` (:543, :556); seeds :311 +
  `routes/projects.js:831`; `scripts/release-health-check.mjs:355` asserts that shape.
- RISK `js/data/generationControls.js:43-45` same `_mediaTypeOf` (agent path); :211-256
  `namedParamsFor` (type falls back to 'flux' :219); :293-294 duration 1..30; :490 batch.
- RISK `js/utils/modelHelpers.js:41-49` selected-model store `{image, video}`; `js/state.js:43-55`,
  `js/core/storage.js:317`.
- RISK `MpiGalleryBlock.js:1252, 2066-2067` coerce `s_lastSelectedMediaType` to video|image;
  same in `js/shell/agentDispatch.js:234`; :1280-1281 default op t2v|t2i.
- RISK `MpiModelPicker.js` :84-85, :99 ternaries; :107-114 header; :151-152 builds only image +
  video blocks (audio models never listed).
- RISK `MpiModelManager.js` :188 Media filter; :742 queued accent; :754-755, :1435-1448 tile
  media/preview; :855-867 detail pill; :912/:940 thumb; :1219-1225 header; :1243-1244 sections.
- `MpiTileSheet.js` :58 media typed image|video (4:5 vs 16:9 thumb); :105-107 badge "Image" for
  any non-video; :28 a "Makes audio" flag exists. Flow Library already has an AUDIO section
  (`MpiFlowLibrary.js:37-41`).
- Generation lifecycle already handles audio end to end (`generationService.js` :128-150 missing
  slot toast, :1011 `isAudio`, :1202-1204 `Output_Audio` promote, :1503-1511 `createAudioItem`;
  `routes/projects.js` :2269-2281, :2458-2461, :2528-2531). Keys only on
  `model.mediaType === 'audio'` + op `mediaType: AUDIO`.
- Smoke runner `scripts/smoke-workflows.mjs` RISK :1007-1011 model op with a required non-image
  input is SKIPPED (Chatterbox); RISK :1119-1121 model op counts only image/gif/video → audio
  "produced no media" FAIL. Flow leg counts audio :1784-1788; probe `smoke-probe.wav` :1691.
- `release-health-check.mjs:383-391` op parity (models' `supportedOps` in both registries).

**Voice library / required / derived**
- Voice picker exists only on the Flow path: `MpiVoicePicker.js:52`, `voiceLibrary.js:47, 246`,
  `MpiMediaPicker.js:65-82` takes `voiceRoute`/`voicePicker`/`recordAudio` props; only
  `MpiBaseFlow.js:914-927, 3755` wires them. CommandDef `mediaInputs` has no `voiceLibrary`.
  `recordAudioIntoProject` is a Block (`MpiAudioRecorder.js:535`) — pass it down as a prop.
- Required slot: enforced at enqueue/dispatch only (`generationService.js:529, 963`).
- Derived: Flows only (`declaredFields.js:594-597`, `MpiBaseFlow.js:3323-3328`).

**Agent / connector / MCP**
- `agentDispatch.js` :1600-1692 `_listModels` (models vs flows lists; voices built only for Flows
  :1645, :1684); :632 `resolveAgentMedia` has no `{role, voice}` for model ops; :1064-1160
  `slotVoices`/`resolveVoices` read FlowDef slots only.
- `services/agentLoop.mjs` :116 `duration` "Video ops only"; :1233-1240 voice names from
  `list.flows` only; :1720-1732, :2110-2175 voice + review confirm cards gated on `args.flowId`;
  :2043-2046 `IS_A_FLOW`; :1962 "read app:flows".
- `services/agentCorpus.mjs:190-207` `app:operations` from the registry (new ops need `info` +
  `help`); :128 guides per model (no audio guide in `docs/agent/models/`).
- `routes/connector.js` :144-153 roles; :972-1050 `/connector/models` folds voices into Flow rows
  only (:1031-1035); :543-560 flowId XOR modelId.
- `routes/mcp.js` RISK :442 `slow` only for Flow or video → audio model waits synchronously
  (Stable Audio up to 190 s); :92 thumbnails image|video only (audio none = fine).
- `modelPriority.js:34, 156-177` task ranks (no audio task). `MpiAgentChat.js:85-89` "speech"
  mascot clip from Flows only (cosmetic); :969 audio result tile exists.

## B. What removing the two Flows touches

**References** — registries: `flowsRegistry.js` (chatter-box :1558-1755, sound-and-music
:2527-2628, comments :245, :1504-1516, :2024, :2072, :2086, :2336, :2563); `commandRegistry.js`
:1351-1362, :1427-1439, comments :88-94, :1401; `universal_workflows.js` :134-136, :153-155;
`operationRegistry.js` :105, :110; `operation_registry.json` :195-199, :220-224; `licences.js`
STABLE_AUDIO_3 :363-467, key `'flow:sound-and-music'` :482-486; deps `assetDeps.js` chatterbox
:425-630 (all `targetPath`), Stable Audio :1341-1421 (no targetPath); `nodesDeps.js:324-334`.
Generated `resources/cubric/update-manifest.json`. Comment-only: `downloadManager.js:419, 615`,
`projects.js:2329-2330`, `connector.js:50`, `agentDispatch.js:1169, 1652`,
`declaredFields.js:879`, `MpiBaseFlow.js:3317`, `MpiFlowLibrary.js:468`,
`MpiModelManager.js:1655-1659`.

**Tests** — `agent-flow-handover.test.cjs:58,110,118-119`; `agent-loop.test.cjs:3492-3552,
3711-3735`; `agent-voice-library.test.cjs` (many); `connector-flow-dispatch.test.cjs:94-249`;
`flow-derived-fields.test.cjs:32-81`; `flow-uninstall-guard.test.cjs:67-80` (BREAKS: chatter-box
own deps empty); `inject-params-titles.test.cjs:574-578`; `mcp.test.cjs:186`;
`smoke-flows.test.cjs:143-147, 249`; desktop `flow-library-filters.spec.js:167-181` (5 audio
create tiles → 3), `flow-pick-voice.spec.js:58`, `agent-chat.spec.js:408-422, 835`.

**Docs** — `docs/playbooks/add-flow/existing-flows/chatter-box.md` + `sound-and-music.md`;
cross-links `song.md`, `drama-box.md`, `voice-changer.md:156`, `01-descriptor-and-ops.md:335,340`,
`any-of-models.md:177`, `07-agent-knowledge.md:90`, `download-manager.md:209,830`,
`generation-lifecycle.md:200`, `project-integrity.md:305`, `bump-engine/01-smoke-run.md:184-205`.
Agent: `docs/agent/flows.md:86-111` (spoken-line tree), `docs/agent/routines.md:49`; skills
`.claude/skills/cubric-vision-flows/SKILL.md` (description says TTS is reached via Flows; :128
wrong prefix), `.claude/skills/cubric-vision/SKILL.md:65`; bench fixture
`services/agentBench/connector-models.json:2167-2231`. Notes `docs/releases/UNRELEASED.md:112-130`
("Thirteen"). Evidence `dev_configs/smoke-evidence.json:667-725` (keyed `{model:'flow'}`),
`smoke-run.txt`, `smoke-workflows.mjs:1536, 1921, 1952`.
OUTSIDE the repo: Docs site `pages/flows.html`, `pages/audio.html:8`, `pages/home.html:20`
("Thirteen"), `llms.txt:23`, `scripts/seo-routes.mjs:204`; Website `index.html:247, 272, 275`.

**Installs** — a Flow has no install record: deps on disk ARE the state, keyed `flow:<id>`
(`flowsRegistry.js:309, 2699-2708`; `modelRegistry.js:230-309`). A model is a pure disk check
(`modelRegistry.js:211-331`, `isModelUsable` needs one op installed). **Same dep ids → existing
installs read installed on first sync** (chatterbox via `targetPath`, also on a Pod volume).
Licence receipts: localStorage `mpi_model_licence_accepted`, keyed by DESCRIPTOR id
(`licences.js:521-557`) → re-key the map entry, keep `STABLE_AUDIO_3` id + `version: 1` = nobody
re-prompted. `poweredBy` then renders in the Model drawer (`MpiModelManager.js:970`).

**Orphans** — `ComfyUI_Fill-ChatterBox` is universal custom_nodes, never swept; voice-changer
still declares it. Chatterbox weights (`targetPath`) are never swept — with no owner they strand
forever. **Stable Audio weights ARE sweep candidates**: if no Flow and no ModelDef declares them,
the next uninstall of anything sweeps 11.81 GB (`downloadManager.js:304-317, 3524`). → Flow
removal and ModelDef MUST land in the same commit.

**Old cards** — sidecar holds `operation`, `modelId: null`, `flowId`, `flowInputs`. No
regenerate; Reuse only: unknown flowId → `openFlowFromReuse` false (`flowService.js:580-583`) →
injects into whatever model is active, no warning, drops language/voice
(`MpiGalleryBlock.js:1355-1400`, History twin `MpiGroupHistoryBlock.js:2434`).
Tombstone = `deprecated: true` in BOTH op registries (precedent `flowHeadSwap`/`flowDramaBox`,
`operationRegistry.js:71-104`); deprecated ops must LEAVE `commandRegistry`
(`release-health-check.mjs:359-414`). Playbook: `docs/playbooks/add-model/README.md:178-243`.

**Routines / agent** — routine steps `{ flowId, fields, params }` (`routineModel.js:6-8`), stored
`<userData>/agent/routines/*.json`; a stale step fails `UNKNOWN_FLOW` at quote/run
(`routineModel.js:305-307`, `routineRunner.js:123-185`, `routineDispatch.js:45-68`). Agent
`generate` with flowId → `_submitFlow` (`agentDispatch.js:545, 1030-1060`), unknown → `UNKNOWN_FLOW`
(:1143, :1338). Agent memory (`services/agentMemory.mjs:75`) may name `chatter-box`.

**Graphics** — `comfy_workflows/display/flow-chatter-box.webp` 896x1120 + `.mp4` 1280x800;
`flow-sound-and-music.webp` 896x1120 + `.mp4`. A model tile takes `image` for any non-video
(`MpiModelManager.js:754-755`), 4/5 aspect (`MpiTileSheet.css:56-57`); model stills are
896x1088. The webps drop straight in as `image`.

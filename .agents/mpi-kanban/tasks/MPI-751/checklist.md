# MPI-751 checklist

- [x] Rule resolves relative and /js/ absolute import paths against the importing file, classifies by resolved tier dir
- [x] Rule enforces the full tier table (Primitives: none, Compounds: Primitives, Organisms: Primitives+Compounds), separator-agnostic
- [x] RuleTester check: tests/eslint-tier-rule.test.cjs (16/16; HEAD rule misses the grid import, new rule catches it)
- [x] npm run lint: 27 violations, identical to an independent resolver over js/components
- [x] Brief the user per violation (2026-09-14)
- [x] User go (2026-09-14): option (b) — new rule + test parked in `rule/`, HEAD rule back in the tree; land the rule once every hit is cleared
- [x] Fix 1: `MpiWaveform` -> Primitives (5a51434c)
- [x] Fix 2: Compounds emit `ui:context-menu`, `shell.js` shows `MpiContextMenu` (5a51434c). Lint clean, npm test 972/972, desktop gallery-audio-waveform / flow-audio-player / gallery-archive / gallery-cue-all 11/11. Parked rule: 27 -> 22 hits
- [x] Rule maps updated for `ui:context-menu` + MpiWaveform tier (user go 2026-09-14): component-events-primitives/blocks/organisms, component-mounts, events.md
- [x] Parked progress check: `npx eslint -c .agents/mpi-kanban/tasks/MPI-751/rule/tier.eslint.config.cjs js/` (22 hits left)
- [x] Fix 7 (user go 2026-09-14, option a): `MpiMediaPicker` takes `recordAudio` + `voicePicker` props from `MpiBaseFlow` (its only audio consumer); `toWavFile` -> `js/utils/toWavFile.js`. Lint 0, npm test 991/991, desktop media-picker-cards + flow-audio-player 10/10 (new gate check). Parked rule: 22 -> 20 hits
- [x] Fix 6 (user go 2026-09-14): `loraSlotParts.js` -> `js/components/` root (imports Primitives only; consumers MpiModelSettings + MpiLoraRack). Lint 0, npm test 991/991, desktop flow-lora-button + model-settings-popup 3/3. Parked rule: 20 -> 19 hits
- [x] Fixes 5 + 9 (Fabio: "your pick", 2026-09-15): `MpiCompareOverlay` -> Organisms, `MpiMaskedImagePreview` -> Compounds. Lint 0, npm test 1016/1016, desktop mask-persist-roundtrip 3/3. Parked rule: 19 -> 17 hits. Compare overlay visual check with Fabio pending
- [x] Fixes 3+4 (2026-09-15): `MpiAudioPlayer` + `MpiVideoControlBar` -> Organisms, `MpiBaseFlow` (+ `stepKinds.js`) -> Blocks, `composeObjectAlpha` -> `js/utils/maskUtils.js`. Lint 0, npm test 1016/1016, desktop 9 flow specs 16/16 + mask-persist-roundtrip / gallery-renditions 9/9. Parked rule: 17 -> 6 hits (all fix 8)
- [x] Master red since 83715ebe (Fabio 2026-09-15: MPI-749's session is archived, fix it here): `gallery-audio-waveform.spec.js` host sat under the fixed titlebar once MPI-749 removed the grid's toolbar row. Host moved to `top: var(--titlebar-h)` + an `elementFromPoint` guard (fails by name on the old fixture). Spec 1/1
- [x] `docs/playbooks/add-flow/04-overlay-and-shell.md:11` MpiBaseFlow row -> Block / `Blocks/MpiBaseFlow/` (was under MPI-754's claim until it committed 2d13cf47)
- [ ] Fix 8 (MpiFlowLibrary, MpiModelManager, MpiRunpodSettings, MpiLlmSettings -> Organisms; MpiRemote -> Blocks; MpiOllamaSetup stays): waits for MPI-754 Phase 3 (session 6ebab8b3, live claim on MpiModelManager.js/.css). Open decision for Fabio: keep a `LandingPages/` subfolder under each tier, or flatten
- [ ] Land rule + test from `rule/`, lint clean on the new rule

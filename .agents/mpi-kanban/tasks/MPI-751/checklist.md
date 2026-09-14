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
- [ ] Fixes 3-6, 8, 9 (awaiting go; recommendations in handoff c33e52cc; fix 8 now proposed as 4 -> Organisms + MpiRemote -> Blocks)
- [ ] Land rule + test from `rule/`, lint clean on the new rule

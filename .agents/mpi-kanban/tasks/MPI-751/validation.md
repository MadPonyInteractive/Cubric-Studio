# MPI-751 Validation

Progress check for every fix: `npx eslint -c .agents/mpi-kanban/tasks/MPI-751/rule/tier.eslint.config.cjs js/ -f json`
(runs only the parked rule; count its `no-same-tier-component-import` messages). `npm run lint` must stay at 0.

## Fixes 1 + 2 (5a51434c) — 27 -> 22 hits

Lint clean, npm test 972/972, desktop gallery-audio-waveform / flow-audio-player / gallery-archive /
gallery-cue-all 11/11.

## Fix 7 (2026-09-14, option a) — 22 -> 20 hits

`MpiMediaPicker` no longer imports `MpiAudioRecorder` / `MpiVoicePicker`. It takes `recordAudio` and
`voicePicker` props; the mic card needs `recordAudio`, the voice card also needs `voicePicker`.
`MpiBaseFlow` is the only consumer that opens an audio picker (`MpiPromptBox` and
`MpiToolOptionsPlace` open image pickers only), so it is the only one passing them.
`toWavFile` moved to `js/utils/toWavFile.js` (not `wavEncoder.js`, which stays import-free for bare-Node tests).

- `npm run lint`: 0
- `npm test`: 991/991 (baseline before the change: 991/991)
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/media-picker-cards.spec.js tests/desktop/flow-audio-player.spec.js`: 10/10,
  including the new check "the mic and voice cards render only when the slot hands their components in"
  (fails on the old code: an audio picker without props rendered the mic card)
- Parked rule: 20 hits; no `MpiMediaPicker` hit left

## Fix 6 (2026-09-14) — 20 -> 19 hits

`js/components/Compounds/MpiModelSettings/loraSlotParts.js` -> `js/components/loraSlotParts.js`, beside
`shaderBackground.js`: no tier folder, imports Primitives only, consumed by two Compounds.

- `npm run lint`: 0
- `npm test`: 991/991
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-lora-button.spec.js tests/desktop/model-settings-popup.spec.js`: 3/3
- Parked rule: 19 hits; no `MpiLoraRack` hit left
- Not touched: `js/components/Compounds/MpiGalleryToolbar/filterPanel.js:4` still names the old path in a
  comment. The file is under MPI-749's live claim, so its owner was messaged instead.

## Fixes 5 + 9 (2026-09-15, session 088b3125) — 19 -> 17 hits

- Fix 5: `Compounds/MpiCompareOverlay` -> `Organisms/` (it composes Compound `MpiCompareView`). Importers:
  `MpiGalleryBlock.js`, `MpiGroupHistoryBlock.js`, `js/pages/components.js`.
- Fix 9: `Primitives/MpiMaskedImagePreview` -> `Compounds/` (it composes Primitive `MpiCanvas`'s
  `ViewManager`). Importer: `MpiCanvasViewer.js`.
- Both: `preloadStyles.js` renamed in place (keeps cascade order), `types.js` typedef comments, header
  tier words, rule maps (`component-mounts.md` header; the `MpiCompareOverlay` events entry moved from
  `component-events-primitives.md` to `component-events-organisms.md`).
- Trap: each component also names its own stylesheet in `ComponentFactory` `css: [...]`. Lint and
  `npm test` stayed green with the OLD folder there; only a repo-wide grep for the old path caught it.
  Grep the old path after any tier move, not just `import` lines.

- `npm run lint`: 0 (plus eslint on all 7 touched files after the css fix)
- `npm test`: 1016/1016
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/mask-persist-roundtrip.spec.js`: 3/3
  (prompt-mode preview mounts from the new path)
- Parked rule: 17 hits; no `MpiCompareOverlay` / `MpiMaskedImagePreview` hit left
- No spec opens the compare overlay; a script resolving every import, `css:` and preload path in the touched
  files found 0 missing, and the history-block specs below load `MpiGroupHistoryBlock`, which imports it

## Fixes 3 + 4 (2026-09-15, session 088b3125) — 17 -> 6 hits

Coupled: AudioPlayer and VideoControlBar compose the Compound `MpiVolumeControl` (which imports Primitives,
so it cannot drop a tier), so they go UP to Organisms, and that makes `MpiBaseFlow` (an Organism importing
them, `MpiVideoViewer` and the six step Organisms) the next hit, so it goes up to Blocks, where only
`shell.js` imports it. `stepKinds.js` travels with it. `MpiTrimBar` stays a Compound (an Organism may import it).

- `composeObjectAlpha` (+ its JSDoc) moved verbatim from `MpiStepCutout.js` to `js/utils/maskUtils.js`
  beside `alphaStencil`; MpiStepCutout (2 call sites) and MpiStepPlace import it from there.
- Paths updated in 36 files: importers, `shell.js`, `preloadStyles.js` (in place), `types.js` tier words +
  prose, 10 unit tests + 9 desktop specs that read or import the MpiBaseFlow path (one via `path.join`
  segments), `docs/playbooks/add-flow/README.md`, `docs/gallery-audio-cards.md`, component maps.
- NOT updated: `docs/playbooks/add-flow/04-overlay-and-shell.md:11` still says `Organisms/MpiBaseFlow`. The
  file is under MPI-754's claim with uncommitted edits; its owner was messaged.

- `npm run lint`: 0
- `npm test`: 1016/1016
- Repo-wide path check over 258 js files + 104 preload entries: 0 real misses (9 hits are pre-existing JSDoc prose)
- `npx playwright test --config=playwright.desktop.config.js` flow-audio-player, flow-clear-slot-advances,
  flow-lora-button, flow-result-follows-steps, flow-roster-survives-navigation, flow-section-tag-picker,
  flow-slide-scroll-reaches-top, flow-step-field-hidden, flow-step-gate: 16/16
- Same config, mask-persist-roundtrip + gallery-renditions (load the history block): 9/9
- Parked rule: 6 hits, all fix 8 (LandingPages), blocked on MPI-754's uncommitted MpiFlowLibrary edits

## Master red since 83715ebe: gallery-audio-waveform (2026-09-15, Fabio's call)

MPI-749's session is archived, so nobody else would ever turn master green, and a red master blocks
every push through `.husky/pre-push`.

- Symptom: step 4 "the played half tints the card background toward the audio accent", expected > -6.35,
  received -12.85, identical in CI and locally (so deterministic, not timing).
- Root cause: the fixture host was `position:fixed; top:0; z-index:9000`. `.titlebar`
  (`styles/shell/titlebar.css`) is `position:fixed; height:var(--titlebar-h); z-index:9999`. While the grid
  had its own toolbar row the cards started ~45px down, clear of it; MPI-749 (83715ebe) moved that toolbar
  into the project bar, the card rose to the host's top edge, and the titlebar painted over the top 32px.
  Both "fill" bands (top 2px .. 8% of height) were reading the titlebar (g-r about -13) on both halves.
  Step 3's "ink brighter than the top band" had been passing against the titlebar too. The product was
  never broken: the failure screenshot shows the played half tinted.
- Fix: host at `top: var(--titlebar-h)`, plus a guard before any sampling that
  `document.elementFromPoint` at the band's top-left lands inside the waveform.
- Proof: guard added alone first, on the old fixture -> fails with "the sampled top band must be the
  waveform, not chrome painted over it". With the host moved -> spec 1/1.
- Blast radius: 5 desktop specs mount a `top:0` fixed host; only this one reads pixels (the renditions
  spec asserts DOM), and no testing doc recommends the pattern.
- Full desktop suite before pushing over the red (`npx playwright test --config=playwright.desktop.config.js`,
  tree at 16e8dd67 plus peers' uncommitted MPI-754 Phase 3 / MPI-756 edits): 68 passed, 1 failed —
  `flow-slide-scroll-reaches-top`. Its error text was not captured (the run's output filter kept only the
  summary). Same committed code then passed it 5/5: alone 1/1, `--repeat-each=3` 3/3, and in the 9-flow batch.
  The spec (c7bfb93c, 2026-08-27) only had its MpiBaseFlow path string changed here, and it asserts the slide
  OVERFLOWS, a layout measurement. Read as a flake under full-suite load, not a regression. If CI reddens on it,
  capture the message before changing anything.

## Fix 8 + rule landed (2026-09-15, session ee0a88e8) — 6 -> 0 hits

Gate: MPI-754 Phase 3 committed e9063a7a (07:32Z), `js/components/Compounds/LandingPages` + `types.js` clean,
no live claim. CI run 34940860825 on 16e8dd67: success. Fresh claim 480469dd.

Flat, per Fabio: MpiFlowLibrary, MpiModelManager, MpiRunpodSettings (import the Compound MpiOkCancel) and
MpiLlmSettings (imports the Compound MpiOllamaSetup) -> `Organisms/<Name>/`. MpiRemote then imports two
Organisms; only `projectUI.js` mounts it -> `Blocks/MpiRemote/`. MpiSettings, MpiAbout, MpiOllamaSetup and
mpi-hotkeys stay in `Compounds/LandingPages/`.

- One script: exact-count asserts per file before any write; every relative specifier inside the moved
  folders re-resolved from its new home (73 rewired); CRLF preserved; plain rename.
- Paths updated in 23 files: the 5 components (`css:` + imports), `shell.js`, `projectUI.js`,
  `preloadStyles.js` (in place), `types.js` (paths + tier words), 3 add-flow playbook docs,
  `docs/workspaces.md`, 6 unit tests, 4 desktop specs.
- Miss caught by the suite, not the grep: `tests/flow-licence-surface.test.cjs` splits its `path.join`
  over a line break, so `'Compounds', 'LandingPages',` and `'MpiFlowLibrary'` sat on different lines.
  `npm test` failed ENOENT on the old path; fixed.
- NOT updated: `.claude/rules/component-events-primitives.md:263` (269 after 54f4438a) still names
  `(Compound — js/components/Compounds/LandingPages/MpiModelManager/...)`. Rule file: waits on Fabio's go.
- NOT updated: `resources/cubric/update-manifest.json` is release-generated (it still lists the
  pre-b1f2de34 `Organisms/MpiBaseFlow` paths too).
- Rule landed: `rule/no-same-tier-component-import.js` -> `.eslint-rules/` (62 changed lines vs HEAD),
  `rule/eslint-tier-rule.test.cjs` -> `tests/`.

Evidence:
- Parked rule before landing: 0 hits (was 6)
- Repo-wide resolver (every relative import in `js/**`, every `css:` entry, 104 preload entries,
  193 test/doc path literals): 8 misses before AND after the move, identical, all pre-existing JSDoc/comment text
- `npm run lint` with the landed rule: 0
- `node --test tests/eslint-tier-rule.test.cjs`: 16/16
- `npm test`: 1036/1036
- `npx playwright test --config=playwright.desktop.config.js` flow-library-filters, flow-library-skips-drawer,
  flow-uninstall-button, flows-tab-ring, runpod-settings-extract: 8/8 (ran before the licence-surface test
  fix and the rule landing; neither touches runtime js)

## Close-out (2026-09-15)

- `.claude/rules/component-events-primitives.md:269` MpiModelManager heading -> `(Organism — js/components/Organisms/...)`
  (Fabio's go).
- CI run 34943019470 on 7eb297c9 (fix 8 + landed rule): success.
- Compare overlay (fixes 5+9) closed on mechanical evidence, not a visual pass: the move changed its folder only;
  the repo-wide resolver found every import and its `css:` path, and the history-block specs load
  `MpiGroupHistoryBlock`, which imports it. No spec OPENS the overlay.

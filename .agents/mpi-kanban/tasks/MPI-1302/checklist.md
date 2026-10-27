# MPI-1302 checklist

## Phase 1a: small fixes — pushed 8c05c2c8e
- [x] B4: one uninstall-outcome count for Flow Library and Model Manager, with the MPI-1076 guard
- [x] B6: History toasts go through StatusBar (destroyed on close)
- [x] H3: dropped — the D:\tmp stage dir is deliberate (Fabio's PC, C: short on space); CI passes its own
- [x] Missing assertions: comfy-vanished-prompt asserts the queue was read; agent-loop and thumb-strip counters were never used (nothing to add)
- [x] Lint + tests, commit, push, AUDIT.md status updated

## Phase 1b: shared small utilities
- [x] D6: graph_utils.py (find_by_title, find_id_by_title, prune_to_captures, bake_int) used by 11 handlers; 24 workflows byte-identical
- [x] D8: escapeHtml, basename, clamp/clampInt, orientations/ratio options, formatClock, hexToRgb (tests/small-utils.test.cjs; lint; npm test 3742 pass / 0 fail)

## Phase 1c: X4
- [x] Unused routes removed (Fabio chose: remove the unused skill-listed ones too); skill docs updated
- [x] Internal-only exports un-exported; never-used functions deleted; icons translate/volumeLow deleted
- [x] Icons seed/gallery + renderIcon stroke special case deleted; .claude/rules/dos_and_donts.md line 40 edited (Fabio's OK, 2026-10-26)

## Phase 1d: T1, T2
- [x] T1: typescript 6.0.3 dev dep, tsconfig.typecheck.json, `npm run typecheck` inside `npm run lint` (CI + pre-push); // @ts-check on all 57 js/utils, commandRegistry.js, resolveModelDeps.js, all clean
- [x] T2: JSDoc on promptReuse.js, projectService.js, routes/shared.js (MPI-484 stop, MPI-444 realpath.native)
- [x] Lint + type-check + npm test (3742 pass / 0 fail), AUDIT.md status, docs/DEVELOPMENT.md + red-master.md
## Phase 2: D1, D3/D10, P2, P14, P7, P12, P13
- [x] D1: `_controlHost` (label row, all 17 controls) + `_mountSlider` (the 7 sliders) in PromptBoxControls.js, -262 lines; 198-case desktop snapshot identical before/after; lint + type-check, npm test 3742 pass / 0 fail, 11 PromptBox desktop specs green
- [x] D3: services/outputCard.js (writeVideoCard, writeImageCard, writeImageRenditions moved from projects.js), 10 routes, one commit each; 12-case real-ffmpeg route snapshot identical bar the sheet's flowId/flowInputs; tests/output-card.test.cjs; lint + type-check, npm test 3744 pass / 0 fail
- [x] D10 GIF card tail + gifEntry normalisation: writeGifCard/writeGifThumb (outputCard.js), gifEntryFrom (gifFrames.js), 5 routes; 9-case route snapshot identical; lint + type-check, npm test 3746 pass / 0 fail
- [x] D10 scratch sweeps: services/scratchSweep.js sweepOlderThan, 9 copies (e6a14214b); tests/scratch-sweep.test.cjs; lint + type-check, npm test 3753 / 0 fail
- [x] D10 ffmpeg plumbing: runFfmpeg/runFfprobe (63f0bc913), trimArgs (7ca19c480), mux runner (44313f32b); lint + type-check, npm test 3753 / 0 fail, mux smoke
- [x] D10 ffprobe bypass: extract route on probeVideo (924b0e15e), rotated-clip crop fixed; scratch route drive (plain 320x180/160x90 unchanged, rotated 180x320/90x160), lint + type-check, npm test 3753 / 0 fail
- [x] D10 remote proxy: _forward/_forwardRoute, 7 routes (883092079); mocked-fetch 17-case drive byte-identical; npm test 3753 / 0 fail
- [x] D10 EXIF swap: 8 sites on metadata().autoOrient (416a5ddb8); 37-input equivalence 0 mismatches, image-orientation test green
- [x] D10 lazy imports: connector _corpus() (651182d34), /connector/knowledge 200 with 73 entries; engines/trash/_getSharp and _fail x5 left on purpose (AUDIT Status)
- [ ] P2, P14, P7, P12, P13
## Phase 3–4: see plan.md

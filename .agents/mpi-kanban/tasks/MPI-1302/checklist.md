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
## Phase 2–4: see plan.md

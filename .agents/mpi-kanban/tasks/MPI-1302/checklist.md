# MPI-1302 checklist

## Phase 1a: small fixes — pushed 8c05c2c8e
- [x] B4: one uninstall-outcome count for Flow Library and Model Manager, with the MPI-1076 guard
- [x] B6: History toasts go through StatusBar (destroyed on close)
- [x] H3: dropped — the D:\tmp stage dir is deliberate (Fabio's PC, C: short on space); CI passes its own
- [x] Missing assertions: comfy-vanished-prompt asserts the queue was read; agent-loop and thumb-strip counters were never used (nothing to add)
- [x] Lint + tests, commit, push, AUDIT.md status updated

## Phase 1b: shared small utilities
- [x] D6: graph_utils.py (find_by_title, find_id_by_title, prune_to_captures, bake_int) used by 11 handlers; 24 workflows byte-identical
- [ ] D8: escapeHtml, basename, clamp/clampInt, orientations/ratio options, formatClock, hexToRgb

## Phase 1c: X4 (ask Fabio about skill-listed routes)
## Phase 1d: T1, T2
## Phase 2–4: see plan.md

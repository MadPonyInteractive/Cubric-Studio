# MPI-756 - disk gate credits an interrupted install's own leftovers

## Root cause

Both disk-full pre-flight gates compare `need = sum of declared sizes` against `free`. The
dep's own leftovers from an interrupted install already sit inside `used`, and every install
path frees or reuses them before writing new bytes, so the same bytes are counted twice:

- Remote: aria2 removes `<dest>.part` at start (MPI-136), `_download_hf` rmtrees
  `<dest>.part.hfstage/` at start, httpx resumes a contiguous `.part` and drops a sparse one.
  The wrapper cannot even report the staging tree: `_is_complete_on_disk` stats only
  `<dest>.part`, by apparent size (sparse-inflated for aria2), and uninstall removes `dest`
  + `.part` but never `.part.hfstage/`.
- Local: the gate bills `totalBytes || seedBytes` for every queued dep, while a
  marker-blessed partial at `localPath` is resumed (MPI-317/427). A fresh dep job (after a
  restart) never passes the reset branch, so `downloadedBytes` is 0 there anyway.

## Approach

1. Wrapper `_is_complete_on_disk` returns `reclaimBytes` = allocated bytes (`st_blocks*512`,
   same accounting as `/wrapper/disk` du) of `<dest>.part` plus every file under
   `<dest>.part.hfstage/`. `partialBytes` unchanged. Status reply carries the new field.
2. Wrapper `_download_hf` deletes a stale `<dest>.part` next to its start-of-install stage
   rmtree, so every path frees all of the dep's leftovers before writing.
3. Wrapper uninstall also rmtrees `<dest>.part.hfstage`.
4. App remote gate bills each known dep `max(0, size - reclaimBytes)`. Missing field (old
   wrapper) credits 0. MPI-752 rule kept: no status entry bills 0.
5. App local gate bills each queued dep `max(0, size - getPartialBytes(localPath))`.

Not in scope: remote orphan sweep deleting partials (it only sweeps `installed === true`, and
an in-flight model's deps may classify as orphaned).

## Current State

- 2026-09-15: both app gates and all three wrapper changes are in; offline tests green (see
  `validation.md`). The wrapper self-check `test_partial_reclaim.py` was NOT run after the fix:
  the agent permission classifier refused it (it calls the delete endpoint). A status-only
  subset ran and passed. Card stays in doing.
- 2026-09-15: user ran `test_partial_reclaim.py` -> all assertions passed. Offline side
  complete; wrapper + app committed at handoff.
- Next: live Pod leg on the DEV runtime channel (`./publish-runtime.sh dev`, restart Pod,
  interrupt an HF-primary install, retry must pass the gate, uninstall removes the stage
  tree), then `mpi-end-session`. Docs are already updated.

## Remaining Work

See `checklist.md` (last two items).

## Completed

- Remote + local gate reproductions, then the fix (11/11 node tests).
- Wrapper `reclaimBytes`, `_download_hf` stale `.part` drop, delete removes the stage tree.
- `docs/download-manager.md`: HF staging consequences + MPI-756 gate rule.

## Plan Drift

(none)

## Verification

**Verify mode:** auto

- `node --test "tests/remote-disk-gate-unknown-state.test.cjs"` - new reclaim scenarios fail
  before the fix, pass after (live numbers: 12.0 GB free, 13.3 GB dep whose own partial is
  13.3 GB). No-field control still refuses.
- `node --test "tests/local-disk-gate-partial.test.cjs"` - same shape for the local gate.
- `node --test "tests/disk-full-message.test.cjs"` still green.
- `python wrapper/test_partial_reclaim.py` in `mpi-ci/cubric-vision-pod` - reclaimBytes sums
  `.part` + stage tree; uninstall removes the stage tree.
- Live Pod leg is USER-run: `./publish-runtime.sh dev`, restart Pod, interrupt an HF install,
  retry. Never `stable`.

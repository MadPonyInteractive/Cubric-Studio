# MPI-756 validation

## 2026-09-15 - offline

Reproduced first, green after the fix:

- `node --test "tests/remote-disk-gate-unknown-state.test.cjs" "tests/local-disk-gate-partial.test.cjs" "tests/disk-full-message.test.cjs"`
  -> 11 pass, 0 fail. Before the gate edits, both new credit cases failed with the real
  refusal ("46.3 GB needed ... 27.9 GB free" remote; "Not enough disk space" local). The
  no-reclaimBytes control and the nothing-on-disk control still refuse.
- Wrapper `python -m py_compile wrapper.py` OK. `test_partial_reclaim.py` FAILED before the
  wrapper edit (`reclaimBytes` absent from the status reply).
- Status-only check against the edited wrapper (fixtures in OS temp, no delete call): PASSED.
  `reclaimBytes` is 0 for an absent weight and a custom_nodes dep, covers a stage-only
  leftover, and sums `.part` + stage tree (400000); `partialBytes` unchanged (100000).
  Windows has no `st_blocks`, so this ran on the length fallback; the Pod reads allocated
  blocks.
- `test_hot_store_evict.py` and `test_models_upload.py` pass. `test_manifest_stamp.py` fails
  identically against the HEAD wrapper copy, so it is pre-existing and unrelated.

- User-run 2026-09-15: `python C:/AI/Mpi/mpi-ci/cubric-vision-pod/wrapper/test_partial_reclaim.py`
  -> `partial reclaim: all assertions passed` (status reports `.part` + stage tree, delete
  removes both, nothing left to reclaim after).

## Not verified yet

- `_download_hf` dropping a stale `.part` at start: only reachable on a Pod with
  huggingface_hub.
- Live Pod leg (user-run): `./publish-runtime.sh dev`, restart Pod, interrupt an HF-primary
  install, retry passes the gate; uninstall of that dep removes the stage tree. Never `stable`.

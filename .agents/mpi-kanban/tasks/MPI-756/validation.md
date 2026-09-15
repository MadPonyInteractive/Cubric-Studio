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

## 2026-09-15 - live Pod leg (user-run, DEV channel) - PASSED

- `./publish-runtime.sh dev` from mpi-ci `77641aa`. CPU download Pod `ykwr640unt3i64`
  (EU-RO-1, `cubric-vision-pod:v0.23.0-dev-cpu`) booted with
  `[cubric-bootstrap] fetching runtime from https://pod.cubric.studio/vision/dev (channel=dev)`,
  manifest `wrapper_version 0.2.44`, `wrapper_sha256 49453d78...2595e` = sha256 of the committed
  `wrapper/wrapper.py`; `huggingface_hub already present - hf_xet transport available`.
- Control: on a fresh 55 GB volume (51.2 GB in app units - RunPod GB are decimal) the gate
  refused MiniMax H3 Reference, correctly, with nothing to credit: "52.6 GB needed ... 49.6 GB
  free of 51.2 GB". Volume grown to 60 GB (55.9 GB app units).
- Install started, Pod STOPPED from the RunPod console at ~33.5/50.1 GB. App: "Remote engine
  disconnected before the install finished." Reconnect; `GET /remote/pod/ls` leftovers
  (apparent): `text_encoders/qwen3vl_32b_...int8_convrot.safetensors.part` 23.63 GB,
  `diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors.part` 19.53 GB (HF dep),
  `latent_upscale_models/minimax_h3_latent_upscaler_3d_bf16.safetensors.part` 0.61 GB, plus two
  `.part.aria2` control files (~0). `GET /remote/pod/disk`: used 54549517824 of 60000000000
  (5.08 GB free).
- Retry Install: no disk-full toast, download started, finished INSTALLED with no disk error.
  The pre-fix gate bills the three missing deps in full (~47 GB with margin) against 5.08 GB
  free and refuses.
- Consistent with `_download_hf` dropping the stale `.part`: the HF dep could not re-stage
  19.53 GB beside a kept 19.53 GB `.part` with ~5 GB free. Pod logs not read, so an httpx
  resume of the full `.part` is not strictly ruled out.
- NOT covered live: the HF dep had already finished staging (moved to `.part`) when the Pod
  died, so no `.part.hfstage/` tree existed; stage-tree reclaim and uninstall removing it rest on
  the user-run `test_partial_reclaim.py` above.

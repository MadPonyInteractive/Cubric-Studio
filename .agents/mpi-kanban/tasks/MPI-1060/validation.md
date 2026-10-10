# MPI-1060 Validation

## Phase 1 - bench proof (2026-10-10)

- Single-stage combos: `research/results.md` § Our sheets + combinations.
- Two-stage on the shipped int8 graph: `python gpu_lease.py run -- python -I research/bench-tools/two_stage_run.py
  <7 cases>`, all `success`. Variant A picked. No-sheet regression: `ffmpeg -f framemd5` equal and `cmp` byte-identical
  for t2v and i2v (shipped vs patched). Detail: `research/results.md` § Two-stage proof.
- Open (not blocking): Fabio's eye-test of `C:\AI\MPI-1060-out\ts_ref_A_vs_B.webm` and `ts_ref_start_A.webm`.

## Phase 2b - layout bench (2026-10-10)

- `layout_run.py` under `gpu_lease.py`, 15 clips, all `success`; each inspected frame-by-frame (10-frame contact
  sheets). Winner `compose_pack` on whole pictures: `pack_woman_whole`, `pack_fisher_whole` work; failures recorded
  with their cause in `research/results.md` § Phase 2b. Preview `C:\AI\MPI-1060-out\pack_whole.webm`.
- **Fabio's eye-test PASSED 2026-10-10** ("The results do look good"): the two-stage A clips and the packed-sheet clips.

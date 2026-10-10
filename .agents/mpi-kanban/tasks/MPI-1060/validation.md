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

## Phase 2b - sheet composer (2026-10-10, session "LTX 2.3 Reference 3")

- `node --test tests/ingredients-sheet.test.cjs`: 9/9 pass (tiling inside gutters, no overlap, the bench's
  `compose_pack` cells pixel-for-pixel on two eye-tested sheets, character floor, `where()` names, `<Picture n>`
  parse, colour-in-cell on a real PNG, portrait canvas, one-picture pass-through, hand-written prompt untouched).
- Cross-check: `layout_run.py` (bench python) vs the JS port on woman_whole / fisher_whole / pack_woman: identical boxes.
- Real pictures (her sheet + mountains + 3-view backpack) composed at 960x512 and 544x960 and looked at: wide = the
  bench's layout; tall works but the backpack cell (740 rows) outgrows the woman's (709) - the 45% floor is a soft
  score term. Portrait is unbenched: check in Phase 5.
- `npx eslint` clean on the four touched files; `tests/object-stamp-flip.test.cjs` (engine-fit neighbours) 13/13.
- Inert until a model declares `capabilities.referenceSheet` (Parallel Batch app wiring).

## Phase 3 + 4 - weight + graph (2026-10-10, session "LTX 2.3 Reference 3")

- HF re-host: `create_commit` to `Mad-Pony-Interactive/cubric-studio`, then `model_info(files_metadata=True)`: size
  1308778338, lfs.sha256 `515e4e13...59` == upstream. `npm run release:deps`: "All 331 URLs reachable", the new dep
  absent from the single-route list (HF prefix mirror works).
- Raw splice `research/bench-tools/raw_insert.py`: serialiser round-trips the file byte-exact first; link/back-pointer,
  no-dangle, IfElse-fed and pos/size-unchanged asserts pass. Semantic diff vs HEAD: 18 links repointed, 42 new, only the
  10 source nodes changed.
- Converted API == `two_stage_run.insert(<HEAD API>, 'A')`: 146 nodes, 0 input diffs; generated `ltx_i2v_t2v_int8.json`
  == `insert(<HEAD int8>, 'A')`, 0 input diffs (3 display titles of untitled nodes changed with the engine, unaddressed).
  That is the graph whose no-sheet t2v/i2v ran byte-identical on the bench, so no re-run was spent.
- `validate-injection-rules` OK; `verify-workflow.mjs` both LTX files validate on 48188 (weights merely not installed);
  `tests/inject-params-titles`, `workflow-media-slots`, `optional-media-placeholder` 32/32.

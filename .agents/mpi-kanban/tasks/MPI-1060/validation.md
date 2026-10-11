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

## Parallel Batch (2026-10-10, session "LTX 2.3 Reference 4")

- `node --test "tests/**/*.test.cjs"`: 3041 tests, 3039 pass, 0 fail, 2 skipped. Includes new tests: H3 ref2v_ms
  slot list unchanged, LTX gets pictures + one audio + start frame and no video, REF2V ranking, ROLE_USE text,
  `ltx-2.3:r2v` in the agent corpus, recipe validates.
- `npm run release:check`: fails only on "Engine pin moved 0.34.0 -> 0.39.0 ... smoke-evidence.json is STALE"
  (MPI-623, not this card).
- Not yet seen in a running app: Phase 5.

## Phase 5 - live verify (2026-10-11, session "LTX 2.3 Reference 5")

- Weights: the only engine (48188, Fabio's) reads `G:/CubricModels`; the 12 LTX Balanced deps were staged there
  (10 copied from `C:/AI`, upscaler + foley from R2, sha256 == dep). All 12 sizes == dep `bytes`.
  `/connector/models`: ltx-23-balanced installed=true, missingDownloadGb=0, ref2v_ms offered.
- Harness: scratchpad `harness.cjs` = Playwright-launched REAL Electron, own profile/docs, port 54731, under
  `gpu_lease.py`. Same 3 pictures (woman sheet / mountains / backpack), D5 prompt, seed 42.
- Prompt box (1:1, 3 s): 3 chips -> Picture 1-3, op ref2v_ms; engine got ONE staged 1920x1920 sheet + the
  two-section prompt; card `ref2v_001` + sidecar (card keeps the user's words), 169 s. Clip holds identity,
  outfit, framed blue backpack, path, peaks. PASS.
- Connector 16:9 + portrait 9:16, BEFORE the fix: both copied the sheet layout (split screen; portrait every
  frame). Cause: the help-example prompt shape left Picture 1 out of the character set, so it got neither the
  `(Character)` label nor the character cell weighting. Same seed reproduces frame-exact (ref2v_002 == ref2v_003, md5).
- Fix `sheetRoles` (routes/ingredientsSheet.js) + test; guide + recipe wording. AFTER: connector 16:9 `ref2v_006`
  and portrait `ref2v_007` both full-frame, everything held. PASS. The portrait sheet still gives the prop 37% vs
  the character 35% (soft floor); the clip held anyway.
- `npm test`: 3072 tests, 3070 pass, 0 fail. Previews (VP9): `C:/AI/MPI-1060-out/phase5/`.
- Start-frame toggle (Fabio's spec): `tests/desktop/prompt-box-start-frame-toggle.spec.js` pass; the 8 strip-related
  desktop specs 52/52. Live (prompt box, tag of chip 1 clicked): chips "Start frame / Picture 1 / Picture 2", engine
  `Input_Start_Frame` = the clicked picture pixel-identical, `Input_Image` = a 2-panel sheet with `(Character)`.
  Clip opens on that frame, she turns and walks off; the reference backpack (leather patch) appears from behind.
  PASS. The card itself did not save (I closed the app at Fabio's GPU stop); clip taken from the engine output.
- Open: Fabio's eye-test.

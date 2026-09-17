# MPI-800 Validation

Evidence is recorded here as each phase is verified.

## Phase 1 - code (2026-09-17)

- `node --test tests/comfy-stage-media.test.cjs` -> 6/6 pass (hardlink + reuse, new name after an
  edit, copy fallback on a forced EXDEV, input/ passthrough, ENOENT, route 200/404/400 + data-URL
  into `mpi_staged/`).
- Bites: `fs.link` swapped for `fs.copyFile` in `stageMediaFile` -> "a project file is hardlinked
  ..." FAILS (1 of 6); reverted, 6/6 again.
- 18 existing suites touching `comfyController` / `routes/comfy.js` (list in the session scratch
  `t1.txt`): `node --test ...` -> 123/123 pass.
- `npx eslint routes/comfy.js js/services/comfyController.js .../MpiSettings.js tests/comfy-stage-media.test.cjs` -> clean.
- Not yet live: the renderer change calls a route the RUNNING server does not have until the app
  restarts (Phase 2).

## Phase 2 - pin (2026-09-17)

- /mpi-nodes-sync drift check: node repo clean, HEAD == origin/main == `cff4c3b` (1.2.16); pin was `1de35a3`.
- `git -C ComfyUi-MpiNodes diff 1de35a3 cff4c3b -- __init__.py`: classes only ADDED (MpiLoadImage,
  MpiLoadVideoUpload, MpiLoadAudioUpload), none removed or renamed.
- `node_lock.json` pin -> `cff4c3b321f1eb9dc7403df8db6ed3ac5bd1e8fa` (from `git rev-parse`).
- `curl -L https://github.com/MadPonyInteractive/ComfyUi-MpiNodes/archive/cff4c3b3....zip` -> 521,047 bytes,
  98 entries, top folder `ComfyUi-MpiNodes-cff4c3b.../` (the lockUrl the installer builds resolves).
- Pending: Fabio restarts the app; then `.mpi_node_commit` + `/object_info` on 48188.

## Phase 3 (partial) + commit 1 (2026-09-17)

- raw/ conversion (34 files): guarded script (round-trip serialisation, no NEW link
  inconsistency, surviving nodes keep pos/size/mode). Dry-run convert of all 34 against the bench
  (8188, MpiNodes 1.2.16): every difference vs the committed API twins is intended.
- `validate-injection-rules.mjs` Upload check: passes converted flow_stems + klein; FAILS a copy
  with `audio = "bench_test.wav"` (exit 1) and the untitled donor nodes.
- `node --test "tests/**/*.test.cjs"` -> 1312 tests, 1305 pass, 6 fail - all six in the three
  test files held for commit 2 (workflow-media-slots, flow-required-media DramaBox,
  flow-model-choice draw-it-in), which assert the REBAKED runtime. Commit 1 carries the HEAD
  versions of those files, so its own suite is green.
- eslint (comfyController, MpiSettings), `node --check` (routes/comfy.js, both scripts),
  py_compile (registry.py, generate_h3.py) -> clean.
- Commit 1 = code + staging test + sync/validator + raw/ + generator comments + this card +
  MPI-800 board/events lines. Held for commit 2 (after Fabio's app restart + bake): node_lock pin,
  rebaked templates/runtime, the three runtime tests, the two comment-only test edits, all docs.


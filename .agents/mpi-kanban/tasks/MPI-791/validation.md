# MPI-791 validation

## Evidence

- **Diagnosis** from a user's `app.log` (not attached; it holds their paths): the first engine
  install logged `startUniversalWorkflowInstall: customRoot=null` and resolved both upscalers
  under the default root at 17:00:43, then `extra_model_paths.yaml written with chosen root`
  at 17:09:29. SAM3 masking worked (ComfyUI reads the default root through `comfyui_default`);
  the Upscale dropdown, fed by `/comfy/list-files`, showed only "None".
- **`tests/engine-asset-visibility.test.cjs`** (8 tests), route-level against the real routers
  on a spare port, throwaway engine + models roots:
  - on pure HEAD (detached worktree): **8/8 fail**, each on its own assertion (no cascade; the
    install test fails on the default-root path without touching the network);
  - on HEAD + this card's hunks only: **8/8 pass**;
  - in the shared working tree (with MPI-656's uncommitted Phase 1 present): **8/8 pass**,
    alongside `extra-model-folders`, `dep-path-agreement`, `model-roots`,
    `remote-engine-assets`, `image-resident-classification`, `uw-partial-install` (38/38).
- **Full node suite** on HEAD + this card's hunks: 1206 tests, 1205 pass, 0 fail (1 skipped).
- `eslint` on the six touched route files + the test: 0 errors (one pre-existing warning,
  `routes/remoteModels.js` unused `no-constant-condition` directive, not this card).

## Covered by the tests

| Fix | Test |
|---|---|
| 1. list-files walks active + default root | "list-files shows a default-root upscaler..." |
| 2. remote upload resolver walks the same roots | "the remote upload finds a local copy..." |
| 3. install resolves against the picked root | "a fresh install checks..." / "...downloads into..." / wiring check on `routes/engine.js` |
| 4. Pod-baked weights listed + present | "on a Pod, list-files adds..." / "a Pod-baked upscaler counts as present..." |

## Not verified

- No real-app run: not the dropdown in a live window, not a real engine install with a
  picked folder, not a real Pod. The renderer is unchanged and reads the route the tests
  drive; the install path change is argument passing checked on the source.
- Existing installs are healed by fix 1 (the files stay in the default root and are now
  listed); nothing moves them.

## Commit scope

`routes/engine.js` and `routes/shared.js` carry MPI-656's uncommitted Phase 1 hunks. This
card's commit uses index blobs built from HEAD plus only these hunks; MPI-656's stay in the
working tree untouched.

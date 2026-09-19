# MPI-818 Validation

## The red, measured (2026-09-19 07:00 UTC)

- `gh run list --branch master --limit 60`: **32 failure, 28 success**.
- `gif-cutout.spec.js:377` red in 11 consecutive runs from `6da64611` (18th 20:16) until
  MPI-771's `ffc6fc7d` (19th 06:51) — a real regression, fixed by its owner.
- `radial-menu.spec.js:168` red from `034d1d52` (MPI-811's fix commit, 05:37) — and MPI-811
  was then closed on a live check while the run was red.
- `flow-packages.spec.js` red at `:251` once and `:118` once, `crop-resize-output:93` once
  then green on the same tree: boot-timeout flakes, and `retries` was unset (Playwright
  default 0).

## radial-menu:168 root cause, proven three ways

1. CI's own `test-failed-1.png` (run 35425715650, artifact `playwright-results`): the
   **"No models installed"** `MpiOkCancel` over an empty gallery.
2. Code: `MpiGalleryBlock` § Zero-installed check raises it when
   `MODELS.filter(isModelUsable).length === 0 && groups.length === 0`; `hotkeyRegistry`
   `radialMenu.toggle` has `!qs('.mpi-modal')` since MPI-811. Only `:168` uses an empty
   project.
3. Locally, before the fix: 6/6 green (this box has weights). After the fix: 6/6 green.
   Fix with the pin removed (`/* MUTANT */`), provoked with the bare-disk sync:
   `Error: no "No models installed" prompt over the gallery … Expected: 0 Received: 1`.
   Restored: 1 pin, 0 MUTANT.

## Also run

- `npm test`: 1349 tests, 1348 pass, 0 fail.
- `bash -n .husky/pre-push`: ok. `npx eslint tests/desktop/radial-menu.spec.js`: clean.

## CI on the shipping commit

- `a9022044` -> run 35428306163: **failure**, but not on this card's specs. `radial-menu:168`
  green, `gif-cutout` gone, retries fired (each failure ran 3x, so none was a flake). Five
  NEW failures, all from MPI-781's `3adf2d5e`, which had been hiding under the older red
  since run 35427730326: it deleted `comfy_workflows/display/flow-head-swap.*` and
  `flow-drama-box.*`, which `gallery-renditions` (x2), `gallery-media-release` and
  `landing-grid-release` loaded as FIXTURE media, and `flow-library-filters` counted
  DramaBox as a built-in. MPI-781's session had closed with the card in `validating`.
  Local baseline on that tree: 5 failed. Fixed: 10 passed.
- `39631f23` -> run 35429283095: **success. 124 passed, 0 flaky, 0 retries used.** First
  green master since `52345592` (2026-09-18 20:04 UTC), twenty runs earlier.

## What generates the reds (for whoever reads this next)

1. **Green locally, red in CI** - the runner has no weights, no GPU, a fresh profile
   (`radial-menu:168`). Provoke the runner's condition in the spec.
2. **A big removal that runs only the tests it touched** (MPI-781: 41 files, 8,496
   deletions, five desktop specs never run). `grep -r` the deleted asset names in `tests/`.
3. **A wholesale commit of a file a peer is mid-edit in** (`6da64611` swept MPI-771's
   half-written `gif-cutout.spec.js` assertions onto master). `.claude/rules/git.md`.
4. **A red master hides the next break.** MPI-781's five sat unseen under the first red
   for three runs. That is the real cost of stacking.


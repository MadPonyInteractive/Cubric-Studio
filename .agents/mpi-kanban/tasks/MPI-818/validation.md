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

(filled after `gh run watch`)

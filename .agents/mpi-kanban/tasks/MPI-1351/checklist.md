# MPI-1351 checklist

- [x] Reproduce the red (`npx playwright test --config=playwright.desktop.config.js tests/desktop/shell-window-no-late-resize.spec.js`)
- [x] Root cause: why the main-process execution context is destroyed right after `electron.launch`
- [x] Fix (app or spec, whichever is wrong)
- [x] Spec green 3 runs in a row
- [x] Full desktop suite: no new reds
- [x] `npm run lint` + `npm test` green
- [x] Commit by pathspec, push

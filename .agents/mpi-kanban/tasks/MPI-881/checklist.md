# MPI-881 - checklist

- [x] Rewrite every server-absolute import under `js/` to a correct relative path
      (18 x `/js/...`, 1 x `/node_modules/mediabunny/...`). Derive the depth per file,
      never hand-count.
- [x] Guard: an ESLint rule so an import specifier starting with `/` fails
      `npm run lint` (`--max-warnings=0`), including `js/components/`.
- [x] Prove the guard RED on the pre-fix code before trusting it green after.
- [x] `npm test` clean.
- [x] `npm run lint` and `npm run lint:components` clean.
- [x] Prove the previously-broken graph now resolves: node-resolve
      `js/shell/navigation.js` -> MpiAudioRecorder -> MpiLevelMeter.
- [x] Confirm the Audio recorder still mounts in the real app - the level meter is
      live UI, so a wrong relative path is silent in tests and visible in the app.

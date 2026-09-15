# MPI-754 Validation

## Parallel Batch "foundations" (2026-09-14, verify mode auto) - PASSED

Two workers, file-disjoint. Orchestrator re-ran every check itself; worker reports were not taken on trust.

### Flow `type` field
- `node --test tests/flow-type.test.cjs` -> pass 1, fail 0.
- Import of `js/data/flowsRegistry.js` grouped by type -> create: ltx-extend, scribble, character-sheet, outpaint, chatter-box, drama-box, stems, minimax-music, sound-and-music (9); edit: head-swap, ltx-foley, scribble-object, voice-changer, object-stamp (5); enhance: ltx-upscale (1). Matches the approved mapping id for id.
- `git diff` of flowsRegistry.js = 15 `type:` lines + a 4-line typedef, 19 insertions, 0 deletions. Playbook: 1 line in `01-descriptor-and-ops.md`, `; type` in `README.md:137`.
- Worker mutation check: `ltx-upscale` set to `'bogus'` -> test failed naming `ltx-upscale`; restored and green.

### `MpiFilterBar` Primitive
- `npx eslint js/components/Primitives/MpiFilterBar js/shell/preloadStyles.js js/components/types.js --max-warnings=0` -> clean. `npm run lint:components` -> clean.
- Imports: `factory.js`, `utils/dom.js`, `utils/icons.js` only. No hex/rgb/hsl in the CSS.
- CSS compared line by line with `MpiModelManager.css:91-174`: same tokens, spacing, 0.14em tag tracking, heat dot; the MpiButton/MpiInput restyle is gone because the bar owns its controls.
- `template()` probe run headless in Node: 15 markup checks passed (separator count, `type="button"` tags, `aria-selected="false"`, search `aria-label`, `autocomplete="off"`, empty trailing slot).
- NOT yet run: `setup()` event wiring (toggle -> `change` with Set copies, trimmed lowercased query, setters silent, `destroy()` unbinds). The repo has no DOM harness (`tests/model-library-preview-cache.test.cjs:14-15`). Code was read and the logic checked; the real check is Phase 2's `tests/desktop/flow-library-filters.spec.js` on an isolated instance.
- Line endings: the worker left `types.js` and `preloadStyles.js` fully CRLF in the working tree (HEAD LF, `.gitattributes` `*.js eol=lf`). Orchestrator restored LF; diff unchanged.

### Batch verify
- `npm test` -> tests 991, pass 991, fail 0.

## Phase 2 "Flow Library header" (2026-09-14, verify mode user-ux) - PASSED, verified by Fabio 2026-09-15 ("1")

- User-ux: Fabio checked the header in his app and chose Option 1. The DESIGN.md letter-spacing question (0.14em vs ≥0.16em) went unanswered; kept 0.14em, matching the Model Library.
- The typedef half of the Docs item moved to Phase 3 (types.js claimed by MPI-751, `37193e01`).

- `npx eslint js/components/Compounds/LandingPages/MpiFlowLibrary --max-warnings=0` -> clean.
- `node --test tests/flow-model-choice.test.cjs tests/flow-lora-rack.test.cjs tests/flow-licence-surface.test.cjs` -> 42 pass, 0 fail (`sheet.on('select', ({ item }) => _pick(item.source))` untouched).
- `npm test` -> 991 pass, 0 fail.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-library-filters.spec.js tests/desktop/flow-library-skips-drawer.spec.js tests/desktop/flow-uninstall-button.spec.js tests/desktop/flows-tab-ring.spec.js` -> 7 passed (own port 59735, `:3000` left alone). Filters spec re-run green after the CSS fix.
- New spec exercises the bar's `setup()` for the first time in a renderer: real tag `.click()`, real `input` events, `mpifilterbar:change` payload (Set copies, trimmed/lowercased query), silent `setActive`/`setQuery`, `destroy()` unbinding, persistence across close/reopen, count unchanged under filters, no autofocus, no-match message, and the cached `<img>` surviving a rebuild.
- Negative controls (sabotage asserted applied, restored byte-identical sha1 9376d010…): removing `previewCache: _previewCache` -> fails at `sameImgAfterRebuild`; removing `filterBar?.el?.destroy?.()` -> fails at `emittedAfterDestroy` (received 2).
- Visual (desktop-spec launcher, 1440x900, temp spec deleted): thumbnails stay painted after typing `v`, `vo`, `voi`; accented `10 installed · 5 available — …` renders; side-by-side with the Model Library exposed mixed-case tags -> `MpiFilterBar.css` now `text-transform: uppercase` + `white-space: nowrap` + `user-select: none` (what `.mpi-btn` gave the MM tags); re-shot, matches.
- CR bytes 0 in every touched file; no hex/rgb/hsl in either CSS.
- NOT done: MpiFlowLibrary typedef in `js/components/types.js` (MPI-749 live claim `e1124802`; message `da894aac…`).

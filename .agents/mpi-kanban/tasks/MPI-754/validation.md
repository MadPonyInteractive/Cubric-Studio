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

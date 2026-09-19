# MPI-832 — validation

## Blast radius, measured before the change

`npx eslint js/ --rule '{"no-undef":"error"}'` on the unchanged tree:
**1475 errors across 58 distinct identifiers.**

56 of the 58 are plain browser globals (`document` 591, `fetch` 191, `window` 169,
`setTimeout`, `console`, `Image`, `crypto`, `MutationObserver`, …). Three are Node
globals that are genuinely present: `require` / `module` (the renderer window runs
`nodeIntegration: true` + `contextIsolation: false`, and `js/migrations/` is plain
CommonJS) and `process` (guarded `typeof` in `js/shell.js`, plus a `process.env` read).

`CSSTransition` (`MpiToast.js:202`) looked like a fourth, but it is a real Chromium
interface and `globals@17` lists it under `browser` — no change needed.

**After declaring `globals.browser` + `globals.node`, exactly one violation survived,
and it was a real bug** (below). No staged rollout was needed.

## The bug the rule found on its first run

    js/services/generationService.js:1393  'resolvedDims' is not defined

`resolvedDims` is `let`-scoped to the build loop (declared line 1183, block ends before
the extend post-step). The extend path read it at line 1393 as the fallback arm of
`ext.pixelDimensions || resolvedDims`, so every extend whose server response carried
`pixelDimensions` passed, and one that did not would have thrown
`ReferenceError: resolvedDims is not defined` — the same class of defect as MPI-822's
`isRunning`. Fixed to `intermediate.pixelDimensions`: `intermediate` is `builtItems[0]`,
built from that very variable, and the extend runs at the clip's own resolution.

## Evidence

- `npm run lint` — clean (was: the one error above).
- `npm run lint:components` — clean.
- `npm test` — 1512 pass, 0 fail, 1 skipped.
- `npx eslint .` reports 259 further `no-undef`, **all** inside `engine/`, which is
  gitignored vendored ComfyUI. Tracked code outside `engine/` is at **0**.

## Left on the table (not in this card's scope)

CI never runs ESLint — `.github/workflows/tests.yml` has no lint step, and no script
under `scripts/` invokes it. `npm run lint` is a local gate only, so this rule catches
the next `isRunning` only for whoever runs it by hand.

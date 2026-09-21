# MPI-881 - validation

## The defect, reproduced before the fix

```
$ node --input-type=module -e "import('./js/components/Primitives/MpiLevelMeter/MpiLevelMeter.js')..."
FAIL ERR_MODULE_NOT_FOUND Cannot find module 'C:\js\utils\dom.js' imported from
  C:\AI\Mpi\Cubric-Vision\js\components\Primitives\MpiLevelMeter\MpiLevelMeter.js
```

Node resolves a leading `/` against the DRIVE root. The renderer never notices because the
app serves the repo root as the web root, so the bug is invisible until an unrelated CJS test
happens to pull the file in — which is how it surfaced on MPI-877
(`js/shell/agentDispatch.js` -> `navigation.js` -> `MpiAudioRecorder` -> `MpiLevelMeter`
broke `tests/agent-pinned-settings.test.cjs`).

## What changed

19 specifiers in 13 files, rewritten to relative paths derived per file with
`posixpath.relpath` (never hand-counted). 18 were `/js/...`; the 19th was
`/node_modules/mediabunny/dist/bundles/mediabunny.mjs` in `js/services/frameSink.js`.
Import lines only — no behaviour change, and `git diff -U0` carries nothing else.

The guard is `.eslint-rules/no-server-absolute-import.js`, registered at **`error`** (the
other nine mpi rules are `warn`; those are conventions, this one is a module that cannot be
loaded). It covers `ImportDeclaration`, `ExportNamedDeclaration`, `ExportAllDeclaration` and
`ImportExpression`, so a dynamic `import('/js/...')` is caught too.

ESLint's core `no-restricted-imports` was tried first and cannot express this: its `patterns`
use gitignore semantics, which STRIP the leading slash. `/**` then matches every specifier,
and `/*` reported `'../../factory.js'` as a violation. That dead end is recorded in the rule's
header so nobody re-walks it.

## Evidence

| check | result |
|---|---|
| guard RED on the pre-fix blob (`git show HEAD:…MpiLevelMeter.js \| eslint --stdin`) | 1 error, exit 1 |
| guard RED on a dynamic `import('/js/utils/dom.js')` | 1 error, exit 1 |
| guard silent on a relative specifier (`../../factory.js`) | no report |
| `node --input-type=module` resolve of `js/shell/navigation.js` (the MPI-877 graph) | `RESOLVED navigation graph` |
| `npm test` | exit 0 — tests 1741, pass 1739, **fail 0**, skipped 1, todo 1 |
| `npm run lint` | exit 0 |
| `npm run lint:components` | exit 0 |

The `npm test` tail prints a `✖ failing tests:` block for
`tests/agent-video-attachment.test.cjs:123` — that is the **todo** test (`⚠`, MPI-867), it
predates this card and `fail 0` is the number that counts.

## The live-UI half

A wrong relative path is silent in Node and visible in the app, so the level meter was mounted
for real: a static server over the repo root (so specifiers resolve exactly as the renderer
resolves them) with one synthetic page at `/__probe.html`, driven with `playwright-cli`.
Nothing was written into the repo and the user's `:3000` was never touched.

- `import('/js/components/Blocks/MpiAudioRecorder/MpiAudioRecorder.js')` — whole graph loads.
- `MpiLevelMeter.mount(host, { showValue: true })` paints real DOM:
  `<div class="mpi-level-meter mpi-level-meter--horizontal">` with
  `__track` / `__zones` children and the zone gradient intact.
- All 13 changed modules imported in the browser: `{ total: 13, failed: [] }`.

The only console errors were 404s for `/system/platform-config`, `/concat/events/stream` and
`/log` — API routes a static server does not serve, not resolution failures.

## Noted, not touched

`.eslint-rules/no-same-tier-component-import.js:50` carries a
`else if (source.startsWith('/js/'))` branch that resolved exactly these specifiers. The new
guard makes it unreachable in lint-clean code. It is another card's file and harmless, so it
was left alone — flagged here rather than deleted.

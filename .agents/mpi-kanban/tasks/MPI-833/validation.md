# MPI-833 — validation

## What was wrong

`.github/workflows/tests.yml` ran `npm ci`, `npm test` and `npm run test:desktop` — no
lint step, and nothing under `scripts/` invoked ESLint either. So MPI-832's `no-undef`
fired only for whoever typed `npm run lint` by hand. The bug that motivated it (MPI-822,
`ReferenceError: isRunning is not defined`) would still have reached the user's app past
a fully green CI.

## Three changes

1. **`tests.yml` gets `- run: npm run lint`**, placed after `npm ci` and before the two
   suites — it costs seconds and fails before the ~20 minutes of tests.
2. **`lint` widens from `eslint js/` to `eslint .`** — `routes/` is where a typo costs a
   500, and it was linted by nothing at all. Measured before changing it: the whole repo
   outside `engine/` was already at **0 errors**, so this cost one deletion (below).
   `lint:components` stays as it is.
3. **`engine/**` joins the ignore list.** Vendored ComfyUI, gitignored, so it exists only
   on a dev box and never on the runner — but it carries 259 `no-undef` of its own
   (LiteGraph 94, LGraphCanvas 33, IPython 10, bundled vendor chunks) which made
   `eslint .` unusable locally.

## The one deletion

`routes/remoteModels.js:770` carried `// eslint-disable-next-line no-constant-condition`
over a `while (true)`. ESLint 10 reports an unused directive as a warning, and
`--max-warnings=0` makes that fatal, so repo-wide lint tripped on it. It was dead twice
over: the rule is not enabled here, and since ESLint 9 `no-constant-condition` defaults to
`checkLoops: "allExceptWhileTrue"`, so it would not flag that loop even if it were. The
loop is unchanged.

## Evidence

- `npm run lint` (now repo-wide) — clean, exit 0.
- `npm test` — 1513 pass, 0 fail, 1 skipped.
- Measured before the change: `npx eslint . --ignore-pattern "engine/**" --max-warnings=0`
  reported exactly one problem, the stale directive above.

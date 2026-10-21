# MPI-1217 Validation

## Why (measured 2026-10-21)

- Tests on master, last 10 days: 17 of 239 runs failed (7%). Master was red 23% of the time in
  week 38, 1-5% a week since week 40. Median red spell ~24 min.
- No test ran before a push; agents push straight to master and CI judged afterwards.
- Of 9 recent reds sampled: ~half unit/lint (`npm test`), ~half desktop specs whose seeded
  fixture went stale, one `npm ci` network flake.

## What the gate does

`.husky/pre-push`, after the docs-only skip and before the master gate: checks the PUSHED
commit out into `.git/prepush-<pid>` (hooks off, `node_modules` junctioned to the main
tree's), runs `npm run lint` then `npm test` there, refuses the push on either failing.
A peer's uncommitted file in the shared tree cannot affect it.

## Evidence (this box, 2026-10-21)

Commits built with a private `GIT_INDEX_FILE` on top of HEAD, never pushed, fed to the hook
on stdin (`scratchpad/proof.sh red|green|docs`):

| case | result | time |
|---|---|---|
| adds `tests/zz-mpi1217-broken.test.cjs` (assert 1 === 2) | exit 1, `BLOCKED - npm run test failed`, `✖ MPI-1217 deliberate red` listed | 66-70 s |
| adds a passing test | exit 0, `lint + unit tests green.` | 64 s |
| adds only a `.md` under `docs/` | exit 0, `docs/board-only push - CI gate skipped.` | 0 s |

After every run: 0 leftover `.git/prepush-*` dirs, 0 stale worktrees, main `node_modules`
unchanged (312 entries before and after the junction is removed).
`tests/pre-push-done-gate.test.cjs`: 7/7 pass (its pushes are board-only, so the new gate
never recurses into the suite).

Rejected alternative: a worktree with no `node_modules` (relies on parent-dir resolution)
fails 31 tests, since `js/services/scene/sceneViewer.js` imports `node_modules/three` by a
relative path. Letting post-checkout `npm ci` it costs +15 s per push.

## Seen, not fixed

`tests/comfy-stage-media.test.cjs` "a file that cannot be linked (another volume) is copied
whole" failed once in ~6 full-suite runs inside the gate; 24 parallel standalone runs and
every CI log checked never failed it. Pre-existing and rare; if it recurs it will block a
push falsely, so it is the next thing to look at.

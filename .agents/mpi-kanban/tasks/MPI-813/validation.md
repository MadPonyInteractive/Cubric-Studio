# MPI-813 — validation

## Pre-work finding (2026-09-19): the brief's trigger is disproven, and the helper is gone

The brief records "gif-frames leaves some on-disk state that breaks a later gif-make,
**only once they share a parent directory**". The six fixtures already shared a parent —
`%TEMP%` — before the change, so "a shared parent" was never the new condition.

Tested by re-pointing `TEMP`/`TMP` at an empty scratch root, which moves every
`os.tmpdir()` call those files reach (fixtures, `solidPng`, and `services/gifFrames.js`'s
own `gif-build-`/`gif-extract-` work dirs) under one fresh parent, then running the exact
pair that failed, in the exact order, at the concurrency that still failed:

```
TEMP=<fresh scratch root> TMP=<same> \
  node --test --test-concurrency=1 tests/gif-frames.test.cjs tests/gif-make.test.cjs
  ℹ tests 13   ℹ pass 13   ℹ fail 0
```

The backed-out `tests/helpers/scratch.cjs` is also unrecoverable — not in any commit
(`git log --all -- tests/helpers/scratch.cjs` is empty), not in any of the four stashes,
not on disk, and `git log --all -S'cubric-tests'` hits only the three MPI-810/812 board
commits. So the failure cannot be re-observed against the code that produced it, and
cardinal rule 4 has nothing to bite on: there is no live symptom being patched here, only
a helper being written for the first time from the pattern the repo already proved.

## The fix

`tests/helpers/scratch.cjs`, modelled on `tests/helpers/sandbox-roots.cjs`
(`process.on('exit')` + synchronous `rmSync`). Two deliberate departures from the
backed-out attempt:

- **`<tmpdir>/cubric-tests/<pid>/`**, not one flat shared root. `node --test` gives each
  test file its own process, so the pid level is a per-file sandbox — the isolation the
  old flat layout had by accident, kept on purpose.
- **Nothing deferred.** `mkdirSync` at module load, `rmSync` at exit. A floating
  `remove()` promise landing while a test is still writing is the most plausible shape
  for the unexplained `.meta directory missing`; a synchronous exit hook cannot have one.

Nine call sites moved across six files; the now-unused `node:os` require was dropped from
each. No route, service or component file is touched.

## Evidence

Litter counted as entries in `%TEMP%` matching `gif-test-`, `gif-cutout-test-`,
`gif-make-test-`, `gif-maker-test-`, `gif-transform-test-`, `agent-memory-`,
`legacy-src-`, `solid-`. Baseline before these runs: 0 (the 1042 were swept by hand on
2026-09-18).

| check | command | result |
| --- | --- | --- |
| the pair that failed before | `node --test --test-concurrency=1 tests/gif-frames.test.cjs tests/gif-make.test.cjs` | **13 pass, 0 fail** (the old helper: 1 fail) |
| all six fixture files | `node --test tests/gif-{frames,cutout,make,maker,transform}.test.cjs tests/agent-memory.test.cjs` | **45 pass, 0 fail** — matches HEAD's baseline; the old helper gave 44/1 |
| full suite | `npm test` | **1352 tests, 1351 pass, 0 fail, 1 skipped** |
| litter, temp root | after all of the above | **0** |
| litter, `cubric-tests/` | after all of the above | **0 pid dirs** — the root exists and is empty |

### The throwing path, which is what the card is actually about

Cleanup in the gif fixtures sits *after* the assertions, so a throwing test always
littered. A scratch spec that builds a project-shaped fixture and then throws with no
cleanup line at all:

```
ROOT=C:\Users\Fabio\AppData\Local\Temp\cubric-tests\5900
ℹ pass 0   ℹ fail 1
-> temp-root litter: 0     cubric-tests pid dirs left: 0
```

A red run cleans up after itself. That is the property the `after()`-less fixtures never
had, and it is why the exit hook was chosen over per-file hooks.

## Not done

`tests/` is not linted (`lint-staged` covers `js/**/*.js` only), so there is no lint gate
to run on these files.

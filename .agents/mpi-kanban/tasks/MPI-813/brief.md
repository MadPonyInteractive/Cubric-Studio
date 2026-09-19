# MPI-813 — Unit fixtures build projects in the temp ROOT

Split from [[MPI-810]] on 2026-09-18, on Fabio's call. MPI-810 shipped the half that
mattered — the registry leak — and closed. This card carries the leftover litter, **and
a failed attempt at it**, so the next session does not walk into the same wall.

## The litter

Six unit fixtures `mkdtemp` straight into `os.tmpdir()` and write a `project.json`
inside, so every run leaves a project-shaped folder in the temp root:

| prefix | source |
| --- | --- |
| `gif-test-` | `tests/gif-frames.test.cjs:76` |
| `gif-cutout-test-` | `tests/gif-cutout.test.cjs:30` |
| `gif-make-test-` | `tests/gif-make.test.cjs:29` |
| `gif-maker-test-` | `tests/gif-maker.test.cjs:35` |
| `gif-transform-test-` | `tests/gif-transform.test.cjs:31` |
| `agent-memory-` | `tests/agent-memory.test.cjs:23` |

Measured twice on 2026-09-18, five hours apart: **970 → 1034**, still growing, and 1042
by the time they were swept. `agent-memory-` held at 8 across both — it is the only one
with a real `after()` hook, and it is the pattern the others should copy. Cleanup in the
gif fixtures sits *after* the assertions, so a throwing path always litters.

Two `solidPng` helpers also drop loose `.png` files straight in the temp root
(`gif-frames.test.cjs:85`, `gif-make.test.cjs:38`).

## Severity: cosmetic

This is **not** the registry bug. These fixtures never call the registry; MPI-810 fixed
that at its root (`main.js` now honours a pre-set `APP_DOCUMENTS`, and the desktop harness
sets one per test). All 1042 folders were swept by hand in seconds. Nothing here is
urgent — it is hygiene, and it is why this was split rather than held.

## The attempt that FAILED — do not just redo it

A `tests/helpers/scratch.cjs` exporting `scratchDir` / `scratchDirSync` / `scratchPath`,
mkdtemp-ing under one `<tmpdir>/cubric-tests/` root, with all nine call sites moved over.
Written, measured, **backed out**:

| run | result |
| --- | --- |
| HEAD, six files together | 45 pass, 0 fail |
| helper, six files together | 44 pass, **1 fail** |
| helper, `--test-concurrency=1` | 44 pass, **1 fail** — not a parallelism race |
| helper, `gif-make` alone | 3 pass, 0 fail |
| helper, `gif-frames` then `gif-make` | `gif-make.test.cjs:92` fails |

The failure is `gif/make failed: .meta directory missing` — `routes/gifMake.js:89` does a
plain `fs.pathExists(<folderPath>/Media/.meta)` on a directory the fixture had just
created with `ensureDir`. Under parallel runs it instead surfaced as
`unable to open for read … Permission denied` on a frame PNG, and the failing test moved
around between runs.

Ruled out, with evidence:

- **The shared root being deleted.** A `CANARY.txt` planted in `cubric-tests/` survived a
  full `gif-frames` run; the root and the canary were both still there afterwards.
- **Leftover dirs confusing something.** Eight dummy directories planted in the root, no
  test run, then `gif-make` alone → 3 pass, 0 fail.
- **Parallelism.** Reproduces at `--test-concurrency=1`, and `node --test` runs each file
  in its own process, so cross-file in-memory state is not it either.

So: `gif-frames` leaves *some* on-disk state that breaks a later `gif-make`, only once
they share a parent directory. Mechanism unknown. It was backed out rather than shipped
because cardinal rule 4 applies — a fix whose failure cannot be explained is not
understood.

## Where to start

Find what `gif-frames` leaves behind. Diff `cubric-tests/` before and after a `gif-frames`
run (it left 8 entries), then run `gif-make` against that exact state. Suspect anything in
the gif routes that resolves a path by scanning upward or by prefix rather than from the
given `folderPath` — `.gif-frames` stores are content-addressed by hash, so two projects
under one parent is the new condition this change introduced.

Worth checking first whether one shared parent is even needed: per-file subdirectories
(`cubric-tests/gif-frames/`, `cubric-tests/gif-make/`, …) would keep the one-`rm` sweep
and restore the isolation the old flat layout had by accident.

## Not in scope

~95 other `os.tmpdir()` sites under `tests/` create plain scratch dirs, never projects.
They reach neither the registry nor the litter this card is about.

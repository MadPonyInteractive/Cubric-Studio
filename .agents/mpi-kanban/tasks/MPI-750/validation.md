# MPI-750 validation

## Root cause

`GET /project-stats` group mode resolved each history item via its sidecar `filePath` with a
greedy `path=(.+)$`. Sidecar `filePath`s carry a `&v=<mtime>` cache-bust
(`projectFileUrlBusted`), so the parsed path became `...inpaint_002.png&v=1789122840335`,
`pathExists()` was false for every busted item, and the route answered
`{ success: true, count: 0, bytes: 0 }`. `projectStatsService.refreshGroup` wrote that as
`state.historyStats` for the matching group, and navigation's `state:changed` listener
overwrote the client's `group.history.length` seed with 0. Client code was correct.

`c2c1c662` fixed the identical parse in the orphan GC only. Two siblings kept it:
`/project-stats` group mode, and the `replaceItemId` branch of `/project/save-generation`
(previous media file never deleted, leaked on disk). All three now use `pathFromProjectFileUrl`;
a repo-wide grep finds no greedy `path=(.+)` parse left.

## Evidence

- Repro, real data, read-only: mounted the real router against project `test`, group
  `imported_014` (4 history ids, all 4 sidecars present, all 4 `filePath`s end `&v=...`,
  all 4 media files on disk). Before: `{ count: 0, bytes: 0 }`. After:
  `{ count: 4, bytes: 4877246 }`, equal to the sum of the four file sizes.
- `tests/project-stats-group.test.cjs`: failed before the fix (`count: 1, bytes: 13`, only
  the unbusted item), passes after.
- `npm test`: 971 pass, 0 fail. ESLint clean on the touched files.
- Replace branch: the delete still only runs when the previous path differs from the new
  file (`path.normalize` compare) and never on the new `<id>.thumb.jpg/.webp`, so fixing the
  parse cannot delete the fresh output. Not exercised end-to-end (needs a Comfy download).

## UI confirmed (Fabio, 2026-09-14)

After an app restart (routes live in the Node process; a renderer reload is not enough),
Fabio's own app shows `4 ENTRIES · 4.7 MB` on `test` / `imported_014`. 4877246 bytes is
4.65 MiB, so it matches the route's answer.

## Close-out follow-ups (approved by Fabio, 2026-09-14)

- `docs/releases/UNRELEASED.md` § Fixes: the readout was a released bug (the cache-bust
  commit `868f2aae` is in v1.4.2). The replace-branch leak is left out: not exercised
  end-to-end.
- `.claude/rules/kanban.md`: the `files.json` example now names `mpi-kanban/task-files/v1`,
  matching the plugin's `mutate.md`.
- `tests/project-stats-group.test.cjs`: a second test fails on any greedy `path=(.+)` parse
  in `routes/`, `services/`, `electron/`, `js/`. Its rule finds the three old sites in
  `cf13d39c^:routes/projects.js` and none at HEAD.

# MPI-810 — Specs build projects in the temp ROOT

Split out of [[MPI-809]] on 2026-09-18. This card owns what writes the entry, and
what makes it expensive.

**MPI-809 shipped the same day** (`done`, 18:16). The localStorage mirror is gone,
`list-projects` no longer takes a caller-supplied path list, and a per-project
`hidden` list covers "remove from Landing, keep the files". Re-checked against the
code afterwards: **this card still stands.** `openProject()` still registers the
opened project's parent unconditionally (`js/services/projectService.js:296`, now
awaited), and both specs below still pass `os.tmpdir()`.

What MPI-809 changed is the severity, not the defect. The entry is now genuinely
removable — nothing re-adds it behind your back — so this is no longer permanent
pollution. It is a bare `%TEMP%` entry rewritten on **every desktop run**, and
expensive for as long as it sits there. The new `hidden` list does not help: it is
per-project, and this is a parent dir.

## Two halves, same root cause: `os.tmpdir()` used as a project parent

### 1. Desktop specs register the temp root in the developer's REAL registry

`tests/desktop/gif-cutout.spec.js:394` and `tests/desktop/gif-make.spec.js:96`:

```js
const p = await createProject(name, folderPath);  // folderPath: os.tmpdir()
await openProject(p);
```

`openProject` registers the opened project's **parent dir**
(`js/services/projectService.js:289-296`), and that parent is the bare temp root.

The registry is `<Documents>/…/project-paths.json`, resolved by
`getProjectsRoot()` via `APP_DOCUMENTS` — the developer's real Documents folder.
It is **not** part of the Electron `userData` profile, so however well the spec
isolates its app instance (private port, private userData, private output dir),
this write still lands in the real registry and persists after the run.

Effect on a developer box: every `list-projects` afterwards readdirs the whole
temp tree and stats a `project.json` per entry, and every hit is a candidate
project carrying a thumbnail scan. Removing the entry works now (MPI-809), but
the next desktop run writes it again.

### 2. Unit fixtures leave the projects that make it expensive

`tests/gif-frames.test.cjs:75`, `tests/gif-cutout.test.cjs:29` and
`tests/agent-memory.test.cjs:23` all `mkdtemp` into `os.tmpdir()` directly and
write a `project.json` inside.

Measured twice on this box, 2026-09-18, about five hours apart — the pile is
actively growing, **970 → 1034** leftover folders directly under `%TEMP%`, each
with a `project.json`:

| prefix | 14:15 | 19:30 | source |
| --- | ---: | ---: | --- |
| `gif-test-` | 851 | 907 | `tests/gif-frames.test.cjs` |
| `gif-cutout-test-` | 111 | 119 | `tests/gif-cutout.test.cjs` |
| `agent-memory-` | 8 | 8 | `tests/agent-memory.test.cjs` |

`agent-memory-` held steady across both, which is the one with a real `after`
hook — that is the pattern the other two should copy.

Cleanup is partial, not absent: `agent-memory.test.cjs:20` has
`after(() => made.forEach(rmSync))` and `gif-frames.test.cjs` removes some roots
inline (`fs.remove(root)` at 340/405, `fs.remove(tmp)` at 88). The survivors are
the paths that throw before their cleanup line, plus whatever a cancelled run
leaves. A test that fails therefore litters exactly when you are least likely to
notice.

`tests/gif-cutout.test.cjs` has no removal of its `tmpProject` root at all.

## Fix

- Specs and fixtures create under **one named subfolder**, e.g.
  `<os.tmpdir()>/cubric-tests/<prefix>-XXXXXX`, never the temp root. That alone
  makes the registered parent a scratch dir instead of `%TEMP%`, and makes the
  litter sweepable with one `rm -rf`.
- Cleanup belongs in an `after`/`finally` that runs on the throwing path too,
  not inline after the assertions.
- For the two desktop specs, prefer pointing `APP_DOCUMENTS` at a scratch dir
  for the run so the registry write never reaches the real one. Worth checking
  whether the desktop harness can set it — if not, the subfolder change above is
  the minimum.

There are ~20 other `os.tmpdir()` call sites under `tests/` (`agent-corpus`,
`agent-sessions`, `audio-*`, `content-addressed-store`, `curated-deps-*`,
`dep-path-agreement`, …). Those create scratch dirs, not projects, so they do not
hit the registry — but they are the same litter pattern and the subfolder change
should sweep them in one pass.

## Verification

- Run the desktop suite, then read `<Documents>/…/project-paths.json`: no bare
  `%TEMP%` entry.
- Run the unit suite twice, forcing a failure in one gif spec: no new folders
  directly under `%TEMP%`.
- One-off cleanup of the existing 1034 is a separate manual step, not a code
  change. They are in the temp tree and will be evicted eventually.

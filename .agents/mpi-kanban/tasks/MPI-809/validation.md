# MPI-809 — validation

Both defects on the card shipped. Evidence below is from this box, 2026-09-18.

## Defect 1 — a removed registry entry stays removed

`list-projects` no longer takes a path list from its caller. Commit `e09c2e08`.

**Proved RED on pre-fix code.** `git show HEAD:routes/projects.js` swapped in, same test:

```
AssertionError: a stale extraPaths entry is not scanned
+ [ { name: 'Demo', folderPath: '…/external/demo', … } ]
- []
```

The project came back **and** the registry had been rewritten with the stale path. GREEN
with the fix restored.

## Defect 2 — "Delete project", files unchecked, removes it from Landing

Fabio's call: that gesture must take the project off Landing and delete nothing. It did
nothing at all — it filtered a localStorage mirror `list-projects` then overrode, so the
card returned on the next grid load.

Recorded per-PROJECT in the registry's new `hidden` list, not by unregistering the parent.
The parent-level move drops sibling projects under the same folder, and cannot express this
at all for a default-root project, because the default root is always scanned.

## Test evidence

`tests/project-paths-registry.test.cjs` (4 cases) + `tests/documents-heal.test.cjs` (1 new
case): **12 pass, 0 fail.**

| Case | Asserts |
|---|---|
| stale entry ignored | removed parent stays removed even when a client still sends it in `extraPaths`, and is not migrated back |
| hide leaves the rest alone | hidden project off the list, **sibling under the same parent still listed**, `project.json` still on disk, parent still registered |
| default-root hide | works where there is no parent to unregister |
| hidden entry cleared both ways | `delete-project` (folder gone) and `create-project` (new project at that path) drop it, so a stale entry cannot ghost a real project |
| heal carries `hidden` | a hidden project inside the pre-2.0 Documents folder follows the rename instead of reappearing |

Full suite: **1352 tests, 1350 pass, 1 skipped, 1 fail.** `npx eslint` on every changed
file: clean.

### The one failure is pre-existing and disk-caused, not this card

`tests/download-retry.test.cjs` — *"exactly one write probe per dep, got 0"*. `_writeProbe`
skips when free space is under 1 GiB (`routes/downloadManager.js:2034`) and logs a WARN
instead of the INFO the test counts. C: sat at 100% (395 MB free) during the run.
Reproduced with HEAD's unmodified `routes/shared.js` and `routes/projects.js`, so it is not
this change. Expected to go green once the disk has room.

## Not verified in the running app

The app was not driven for this card — the routes are covered end-to-end by the tests above,
which exercise the real Express routes against a real registry file on disk. A live check of
the Landing context menu would add the renderer wiring; the two call sites changed there are
one `post()` each.

## Left behind

- **MPI-810** (peer, `c15d76f3`) owns the `%TEMP%` fixture litter and the desktop specs that
  register the temp root — the writer this card's brief could only suspect.
- `openProject()` still registers the DEFAULT root as an external parent when a default-root
  project is opened. Pre-existing, harmless for listing (`list-projects` filters it out), but
  it puts a redundant entry in the registry. Not filed.
- `Storage.getLastProject` is written and never read anywhere in `js/`. Pre-existing dead
  code, noticed while checking whether a hidden project could be reopened on boot. Not
  removed — not this card.

# MPI-809 — checklist

## Defect 1 — the registry cannot be cleaned (brief option 1: drop the mirror) — DONE

- [x] `routes/projects.js` `list-projects` — stops migrating caller `extraPaths` into the
      registry; reads the registry only. `extraPaths` is no longer an input at all.
- [x] `js/services/projectService.js` — `listProjects()` sends no path list;
      `openProject()` / `addProjectByFolder()` drop the `Storage.get/setExtraProjectPaths`
      guard and `await` `/add-project-path` (awaited because the mirror was the only thing
      making the registration visible before the write landed); `deleteProject()` drops the
      dead localStorage filter.
- [x] `js/core/storage.js` + `js/core/storageKeys.js` — `getExtraProjectPaths` /
      `setExtraProjectPaths` / `EXTRA_PROJECT_PATHS` removed. Repo-wide grep for
      `ExtraProjectPaths|EXTRA_PROJECT_PATHS|mpi_extra_project_paths` returns nothing.
- [x] `routes/connector.js:530` — dropped the now-dead `extraPaths: []` argument.
- [x] Test: `tests/project-paths-registry.test.cjs`. Registers a parent, lists it, removes
      it, then calls `list-projects` with the path in `extraPaths` as a stale client would.
      Asserts the project is not listed AND the registry on disk is still empty.
- [x] Proved RED on pre-fix code: `git show HEAD:routes/projects.js` swapped in, same test,
      1 fail — `AssertionError: a stale extraPaths entry is not scanned`, the project came
      back and the registry was rewritten. GREEN after restoring the fix.
- [x] Full suite: `npm test` → 1347 tests, 1346 pass, 0 fail (1 pre-existing skip).
      `npx eslint` on all six changed files: clean.
- [x] `docs/project-integrity.md` — the two bullets added by `8f477ab9` rewritten to describe
      registry-only, with the reason the mirror existed and a "do not reintroduce" pointing
      at the test.

## Defect 2 — remove from Landing without deleting — DONE

Fabio's call 2026-09-18: unchecking *Also delete files from disk* must take the project off
the Landing page and delete nothing. It did nothing at all — it filtered a localStorage
mirror the registry then overrode. ("Keep it" is the CANCEL button, not this branch; an
earlier note on this card and in commit `e09c2e08` mislabelled it.)

Built per-PROJECT, not per parent dir. Unregistering the parent was the obvious-looking move
and is wrong twice over: it drops sibling projects under the same folder, and it cannot
express this at all for a default-root project, because the default root is always scanned.

- [x] `routes/shared.js` — the registry file is now `{ paths, hidden }`. `_readRegistryDoc` /
      `_writeRegistryDoc` / `_mutate` preserve the key they are not touching;
      `readHiddenProjects` + `setProjectHidden(folderPath, hidden)` added. Dead
      `writeProjectPathsRegistry` removed — my refactor orphaned it.
- [x] `_healRegistryFile` rewrites `hidden` on the pre-2.0 Documents rename too; dropping it
      there would make a hidden project reappear after the heal.
- [x] `routes/projects.js` — `list-projects` skips hidden folders; `POST /hide-project`;
      `create-project` and `delete-project` clear a hidden entry, so a stale one can never
      ghost a real project at the same path.
- [x] `js/services/projectService.js` — `deleteProject({ deleteFiles: false })` posts
      `/hide-project`; `addProjectByFolder` unhides, which is the user's way back.
- [x] No UI change — the gesture and its copy already exist and are now accurate.
- [x] Tests: 4 cases in `tests/project-paths-registry.test.cjs` (stale entry ignored, hide
      leaves siblings and files, default-root hide, hidden entry cleared from both sides)
      plus 1 heal case in `tests/documents-heal.test.cjs`. 12 pass, 0 fail over the two files.
- [x] `docs/project-integrity.md` rewritten for the two-list registry.

### One pre-existing test fails on this box, unrelated

`tests/download-retry.test.cjs` — *"exactly one write probe per dep, got 0"*. `_writeProbe`
skips when free space is under 1 GiB (`routes/downloadManager.js:2034`) and logs a WARN
instead of the INFO the test counts. C: is at 100%, 395 MB free. Reproduced with HEAD's
unmodified `routes/shared.js` + `routes/projects.js`, so it is not this card. It should go
green once the disk has room.

## Out of scope

- The 970 `%TEMP%` fixture folders and the desktop specs that register the temp root:
  now **MPI-810** (filed by a peer 2026-09-18, commit `c15d76f3`), which names the writer
  MPI-809's brief could only suspect — `tests/desktop/gif-cutout.spec.js:341` and
  `gif-make.spec.js:96` `createProject(..., os.tmpdir())` then `openProject`.
- `openProject()` registers the DEFAULT root as an external parent when a default-root
  project is opened. Pre-existing and harmless for listing (`list-projects` filters it out),
  but it does put a redundant entry in the registry. Not filed.

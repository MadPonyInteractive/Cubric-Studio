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

## Defect 2 — no unregister UI — OPEN, needs Fabio

The brief left this as a fork: expose unregister in the UI, or accept server/API-only (its
docs half was already taken in `8f477ab9`).

Found while fixing defect 1: the UI gesture already exists but does nothing. **Delete
Project with *Also delete files from disk* unchecked** ("Keep it") is exactly "unregister,
keep the folder" — and it is a no-op on the list. It never called `/remove-project-path`;
it filtered a localStorage mirror the registry then overrode. Wiring it up is a two-line
change with a product cost: the registry is **parent-dir granular**, so unregistering takes
every sibling project under that parent off the list too.

- [ ] Decision: (a) wire "Keep it" to `/remove-project-path` and reword the dialog, or
      (b) leave it server/API-only and change the dialog so it stops offering a no-op.

## Out of scope

- The 970 `%TEMP%` fixture folders and the desktop specs that register the temp root:
  now **MPI-810** (filed by a peer 2026-09-18, commit `c15d76f3`), which names the writer
  MPI-809's brief could only suspect — `tests/desktop/gif-cutout.spec.js:341` and
  `gif-make.spec.js:96` `createProject(..., os.tmpdir())` then `openProject`.
- `openProject()` registers the DEFAULT root as an external parent when a default-root
  project is opened. Pre-existing and harmless for listing (`list-projects` filters it out),
  but it does put a redundant entry in the registry. Not filed.

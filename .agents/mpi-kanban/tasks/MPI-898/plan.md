# MPI-898 — A renamed or moved project folder opens EMPTY

Carded 2026-09-22 on Fabio's word ("that sounds very serious"). Found read-only while weighing
a project-folder rename feature, which Fabio then dropped. **Not yet reproduced** — step 1 is
the red spec.

## The failure

1. Every sidecar `Media/.meta/<uuid>.json` stores `filePath` as an ABSOLUTE
   `/project-file?path=C%3A%5C...%5C<folder>%5CMedia%5C<file>&v=<mtime>` url. No `relativePath`
   on the item itself (only `previewAssets.snapshots[]` carry one).
2. `/load-meta-batch` (`routes/projects.js` ~:3012) tests `pathFromProjectFileUrl(meta.filePath)`
   for existence — the OLD folder's path.
3. `js/managers/projectReconciler.js:69-73`: meta present + media "missing" → `_deleteMeta`, id
   dropped; an empty group is dropped; `wasModified` re-persists `project.json`.

Reached by: an Explorer rename/move then re-import (`addProjectByFolder`), and — for every
upgrading user — the 2.0 Documents heal (`routes/shared.js` `_getDocumentsFolder`, ~:136), which
renames `<Documents>/Cubric Vision` → `Cubric Studio` and rewrites only `project-paths.json`.
`tests/documents-heal.test.cjs` never touches a sidecar.

## Fix — a relocation heal on project open

In `/migrate-project` (it already runs on every open, before the client reconciles):

- Per sidecar, derive the root it was saved under: strip `\Media\<file>` from the decoded
  `filePath`. Root ≠ the current `folderPath` (case-insensitive on win32) → rewrite every
  `/project-file` ref in that sidecar whose decoded path starts with the old root to the new
  root, keeping the `&v=` bust: `filePath`, `previewAssets.snapshots[].filePath`,
  `generationSettings.mediaItems[]` and `frozenParams.mediaItems[]` (`url` + `filePath`), and
  any other ref field found in a real sidecar (grep the real project's sidecars for
  `project-file?path=` keys first — do not trust this list).
- Write through `updateItemMeta` (the helper `migratePreviewAssetsStore` uses); reuse its
  `decodeProjectFilePath` / `projectFileUrl` pair. Do not write a second url codec.
- Refs pointing OUTSIDE the old root (another project's file) are left alone.

Also consider, and decide in the plan drift: should the reconciler refuse to DELETE when
EVERY item in a project reads missing? That pattern is a moved folder, never a user deleting
150 files — but it is a guard, not the fix (root-cause rule): only as a second line.

## Plan Drift

- 2026-09-22: heal moved from `/migrate-project` to `/load-meta-batch`, at the existence
  check. Fires only on a miss whose media exists rebased onto the current folder, so an
  unmoved project pays nothing (no every-open scan of 1209 sidecars, no marker). Refs are
  rebased by a generic walk, not a field list: the real Mascots sidecars carry 10 ref
  fields (`thumbPathLg`, `wavePath`, `proxyPath`, `originalUrl` x2 were not in the list).
- 2026-09-22: the FIRST break was not the sidecar delete. `project.json` stores its own
  absolute `folderPath`; `/migrate-project` returned it unchanged and the reconciler
  hydrated from it, so a moved project read its sidecars from the OLD folder (all
  `meta: null`, every item dropped). `/migrate-project` now stamps the folder it was
  opened from. Found by the live check on a real project copy (HEAD `withMeta: 0`).
- 2026-09-22: "refuse to delete when everything reads missing" guard: NOT added. With
  both fixes a move no longer reaches the delete branch; the guard would only mask.

## Current State

Both fixes in `routes/projects.js`, specs green, full suite + lint green, live check on
a real project copy green. Next: close-out (`mpi-end-session`): commit + push.

## Verify

**Verify mode:** auto

- New spec (node test, scratch dir): build a project with sidecars at folder A, rename to B,
  run `/migrate-project` + `/load-meta-batch` → every item `exists: true`, refs point into B.
  Red on HEAD first (it must show the wipe), green after.
- Extend `tests/documents-heal.test.cjs`: a default-root project with a sidecar survives the
  Cubric Vision → Cubric Studio heal with its media found.
- `npm test`, `npm run lint`, `npm run lint:components`.
- Live, sandboxed (`app:isolated` + `APP_DOCUMENTS`, never the user's `:3000`): copy a real
  project, rename the copy, drag it in → gallery full.

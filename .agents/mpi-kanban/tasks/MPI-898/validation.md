# MPI-898 validation

2026-09-22, session 506e5d9c. Verify mode: auto.

## Specs, red on HEAD then green

`node --test tests/project-relocation-heal.test.cjs tests/documents-heal.test.cjs`
with `routes/projects.js` swapped to its HEAD blob (then restored):

- HEAD: `not ok` "a renamed project folder: every item is found..." (`exists: false`, the wipe)
- HEAD: `not ok` "a default-root project keeps its gallery across the heal (MPI-898)"
- HEAD: `not ok` "/migrate-project hands back the folder it was opened from, and persists it"
- Fixed: all pass; "media genuinely gone" (real missing file still reported missing,
  sidecar byte-identical) passes on both.

## Suite + lint

- `node --test "tests/**/*.test.cjs"`: 1809 tests, 1807 pass, 0 fail (1 `# TODO` MPI-867, pre-existing).
- `npm run lint`: clean. `npm run lint:components`: clean.
- Desktop (Playwright) specs NOT run locally; CI runs them.

## Live check, real data (route level, not the Electron app)

Copy of the user's real `cowboys` project (153 items), re-rooted to
`<scratch>/docs/Cubric Vision/Projects/cowboys`, then the parent renamed to
`Cubric Studio` (the 2.0 Documents heal). Replayed `projectService.openProject`'s
sequence: `/migrate-project`, then `/load-meta-batch` on the folderPath it returned.

- HEAD: `withMeta: 0, exists: 0` of 153; folderPath returned = the OLD folder. Gallery empty.
- Fixed, first open: `withMeta: 153, exists: 153, wouldDelete: 0, namingOldRoot: 0`, 256 ms.
- Fixed, second open: same, 39 ms (nothing left to heal).

## Close-out, 2026-09-24

- CI `Tests` run 35953346495 on f89a8562: completed success.
- Claim auditor: 22 proven, 1 overstated, 1 unproven (suite count, not re-run by it; CI
  re-ran it green). OVERSTATED, in the f89a8562 commit body only: list/get/validate-project
  stamp `folderPath` in the RESPONSE, they do not persist it; persisting is new with
  `/migrate-project`. `docs/project-integrity.md` states it correctly.

The Electron app was not booted (the `app:isolated` boot-repair risk to the real engine);
the renderer path past these two routes is unchanged code.

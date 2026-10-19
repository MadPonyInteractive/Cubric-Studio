# MPI-1205 Checklist

- [x] Root cause: `/create-project` accepted a location inside another project's folder; `/delete-project` ran a recursive `fs.remove` over the outer folder, taking the nested project with it. Reproduced with the route's own path logic.
- [x] `/create-project` refuses a location at or below a folder holding a `project.json` (400, names the owner).
- [x] `/delete-project` refuses (409) a folder holding a nested project, for ones made before the check.
- [x] `/delete-project` moves the folder to the Recycle Bin (`trash` package, as MPI-500); a refused move deletes nothing and says so.
- [x] Delete dialog checkbox reads "Also move its files to the Recycle Bin".
- [x] Tests: `tests/project-delete-trash.test.cjs` (3), `tests/project-paths-registry.test.cjs` stubbed off the real bin; 9/9 pass. Real `trash` of a temp folder on Windows confirmed.
- [x] Doc: `docs/project-integrity.md`.
- [x] CI green on the commit: Tests run 39299834217 on 809cce797, all jobs success.

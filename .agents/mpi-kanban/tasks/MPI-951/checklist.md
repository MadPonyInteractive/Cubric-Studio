# MPI-951 checklist

- [x] RETIRED_PATHS deletes CubricVision.exe from FULL bundles as well as delta (scripts/build-portable.mjs,
      `resolveManifestDeletes`, aa76d4b6f)
- [x] Test: `tests/portable-win-layout.test.cjs` 11/11 (full win32 bundle lists the delete, linux/darwin empty,
      a delta keeps its own list). Full suite 3311 pass / 0 fail.
- [x] Safe on every path (apply-update.cjs `applyDeletes`): a fresh 2.0 install never had the exe (no-op);
      an upgraded 2.0 runs CubricStudio.exe (plain delete); a 1.5.x jumping straight to 2.1 runs the old exe,
      which `evictBusyFile` renames aside, and even v1.5.0's win-update.cjs relaunches CubricStudio.exe first.
- [x] mpi-ci cubric-vision-portable.yml: old Cubric-Vision slug dropped (mpi-ci 6ab9048, YAML parses); every
      dispatcher sends Cubric-Studio. Artifact name `cubric-vision-*` left as is.
- [x] 2.1 release note: re-pin CubricStudio.exe (cfba66dc8), for 1.5.x users who never saw the 2.0 note.
- [x] CI green on aa76d4b6f. [ ] First real proof is the 2.1 portable build + a 2.0 -> 2.1 update.

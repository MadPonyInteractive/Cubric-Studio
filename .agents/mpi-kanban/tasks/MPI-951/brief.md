# MPI-951 — 2.1 drops the legacy Cubric Vision names

Raised 2026-09-27 from MPI-708 Phase 3 ("raise a follow-up card for 2.1"). **Do not start
before 2.0 is public**: every step here assumes the installed fleet has taken the 2.0 update.

## What 2.0 leaves behind on purpose

- **Artifact names.** 2.0 publishes `CubricStudio-*` AND the legacy `CubricVision-*` names
  (MPI-708 decision D1), so a user who skipped the 1.5.1 bridge still matches on their old narrow
  update pattern. 2.1 publishes `CubricStudio-*` only. Three `rootName` templates to change
  (read them at pickup; `scripts/build-portable.mjs` near `createUpdateManifest`).
- **The old exe.** Updated Windows installs keep `CubricVision.exe` beside `CubricStudio.exe`
  at 2.0 (decision (c), Fabio 2026-09-17: keep at 2.0, delete at 2.1, the 2.0 note tells users
  to re-pin). 2.1 deletes it.
- **The delete does not happen by itself.** `createUpdateManifest` writes
  `delete: delta?.deletes ?? []`, so a FULL bundle ships `[]` today: the exe only goes if
  `RETIRED_PATHS` (`scripts/build-portable.mjs:90`) names it for every bundle kind, full as well
  as delta.
- **mpi-ci.** `mpi-ci/.github/workflows/cubric-vision-portable.yml` accepts both repo slugs
  (`Cubric-Studio` and `Cubric-Vision`, ~line 50) and names its artifact `cubric-vision-*`
  (~line 95). Drop the old slug once nothing dispatches with it.

## Done means

A 2.0 -> 2.1 update, full bundle AND delta, leaves no `CubricVision.exe`; the 2.1 release lists
no `CubricVision-*` file; mpi-ci builds with the old slug removed.

## 2026-09-29: no legacy names at 2.0 (MPI-972)

Fabio chose NOT to publish a `CubricVision-*` set at 2.0.0; installs older than 1.5.0 download
2.0.0 fresh. So "the 2.1 release lists no `CubricVision-*` file" is met by default. The old exe
and the mpi-ci old slug above still stand.

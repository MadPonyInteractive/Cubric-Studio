# MPI-1210 - 2.1.2 release readiness

Release this week (Fabio, 2026-10-20). Current shipped version 2.1.1.

## Signing (from MPI-616)

The signing code is already on master (`6d64c2d2d`, `build-portable.mjs --sign`, inert
without the flag). The mpi-ci workflow that passes `--sign` sits on mpi-ci branch
`mpi-616-signing` (`18fc3ce`) until a test dispatch proves it.

- [ ] MPI-616's test dispatch green, and its Windows artifact's census all `Valid`
      (see MPI-616 validation.md). If it is not green, ship 2.1.2 unsigned and keep
      the unsigned warning - signing must never hold the release.
- [ ] Merge mpi-ci `mpi-616-signing` into `main` BEFORE the 2.1.2 release build
- [ ] After the release build: download the Windows zip and re-run the census
      (`Get-AuthenticodeSignature` over every .exe/.dll/.node -> all Valid)
- [ ] Drop the unsigned / Smart App Control warning from the 2.1.2 release notes
      and `docs/releases/github-release-checklist.md` only once that census passes
- [ ] Note: the first signed update bundle carries every signed binary again in
      full (signing changes their bytes), so the 2.1.2 delta is larger than usual

## Release

Follow `/mpi-release` for the rest.

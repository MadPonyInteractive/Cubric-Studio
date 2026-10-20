# MPI-1210 - 2.1.2 release readiness

Release this week (Fabio, 2026-10-20). Current shipped version 2.1.1.

## Signing (from MPI-616)

Signing is LIVE: every portable dispatch from mpi-ci `main` (`4796a48`) passes
`--sign`, and the build fails if any .exe/.dll/.node is not Valid. Proven 2026-10-20
on run 39442831579 (24/24 Valid, MPI-616 validation.md).

- [x] MPI-616's test dispatch green, Windows census 24/24 `Valid`
- [x] mpi-ci signing workflow merged to `main`
- [ ] If the release build fails at signing: read the log for `AADSTS` (an Azure
      login error hides behind signtool's bare "unexpected internal error"); the
      client secret expires ~2028-10-19 (calendar reminder 2028-09-19)
- [ ] After the release build: download the Windows zip and re-run the census
      (`Get-AuthenticodeSignature` over every .exe/.dll/.node -> all Valid)
- [ ] Drop the unsigned / Smart App Control warning from the 2.1.2 release notes
      and `docs/releases/github-release-checklist.md` only once that census passes
- [ ] Note: the first signed update bundle carries every signed binary again in
      full (signing changes their bytes), so the 2.1.2 delta is larger than usual

## Release

Follow `/mpi-release` for the rest.
